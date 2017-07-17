const $ = require('cheerio');
const request = require('request')
const querystring = require('querystring');
const util = require('util');

var endpoints = {
	bellevue: [],
	occidental: []
};

const ENDPOINT_PREFIX = 'TRUCKS_';
Object.keys(process.env).forEach(function(envVar) {
	if (envVar.startsWith(ENDPOINT_PREFIX))
	{
		var components = envVar.slice(ENDPOINT_PREFIX.length).split('_', 2);
		if (components.length != 2)
		{
			return;
		}

		var location = components[0].toLowerCase();
		if (location in endpoints)
		{
			endpoints[location].push(process.env[envVar]);
		}
	}
});

var getMessage = function(body)
{
	var base = {
		icon_emoji: ':truck:',
		username: 'trucks',
	};

	for (var key in body)
		base[key] = body[key];
	return base;
};

var processRequestQueue = function(endpoint, queue, callback)
{
	if (queue.length < 1)
	{
		console.log("Submitted full queue to " + endpoint);
		if (callback)
		{
			callback(null);
		}
		return;
	}

	var message = queue.shift();
	request.post({ uri: endpoint, json: true, body: message }, function(err, slack_resp, html) {
		if (err)
		{
			console.error("Failed to submit to " + endpoint + ": ", message, err);
			if (callback)
			{
				callback(err);
			}
		}
		else
			processRequestQueue(endpoint, queue, callback);
	});
};

const BELLEVUE_SCHEDULE_URL = 'http://bellevue.com/food-truck.php';
var fetchBellevueTrucks = function(dayOfWeek, callback)
{
	var DAY_MAPPING = {
		1: 'Monday',
		2: 'Tuesday',
		3: 'Wednesday',
		4: 'Thursday',
		5: 'Friday',
	};

	if (!(dayOfWeek in DAY_MAPPING))
	{
		callback(null, []);
		return;
	}

	var day = DAY_MAPPING[dayOfWeek];
	request(BELLEVUE_SCHEDULE_URL, function(err, schedule_resp, html) {
		if (err) {
			callback(err, null);
			return;
		}

		var parsedHTML = $.load(html)
		var link = parsedHTML('a[name=' + day + ']');
		var truck_cells = link.parent().parent().next().find('tr').eq(1).find('td');
		var attachments = truck_cells.map(function(i, el) {
			return {
				thumb_url: 'http://bellevue.com/' + $(el).find('img').attr('src'),
				title: $(el).find('strong').text(),
				title_link: 'http://bellevue.com/' + $(el).find('a').attr('href'),
			}
		}).get();

		attachments.sort(function(a, b) {
			if (a.title < b.title)
				return -1;
			if (a.title > b.title)
				 return 1;
			return 0;
		});

		var messages = [getMessage({ text: ":bell: *Food trucks* in front of Barnes & Noble today (*" + day + "*), according to <http://bellevue.com/food-truck.php|bellevue.com>" })];
		for (var i = 0; i < attachments.length; ++i)
			messages.push(getMessage({ attachments: [attachments[i]] }));
		messages.push(getMessage({ text: "(Feedback &amp; feature requests can be directed to Jørgen Tjernø <mailto:jorgenpt@gmail.com|&lt;jorgenpt@gmail.com&gt;>)" }));

		callback(null, messages);
	});
};

var formatApiDate = function(date)
{
    var formattedYear = date.getFullYear().toString().slice(-2);
    return util.format('%s-%s-%s', date.getMonth() + 1, date.getDate(), formattedYear);
};

var formatDate = function(date)
{
	var formattedDate = ('0' + date.getDate()).slice(-2);
	var formattedMonth = ('0' + (date.getMonth() + 1)).slice(-2);
    return util.format('%i-%s-%s', date.getFullYear(), formattedMonth, formattedDate);

};

var fetchOccidentalParkTrucks = function(date, callback) {
	var EMOJI_MAP = {
		'snout-and-co': ':pig_nose:',
		'seattle-chicken-over-rice': ':chicken::rice:',
		'bomba-fusion': ':boom:',
	};

	var IMAGE_BASE = 'https://s3-us-west-2.amazonaws.com/seattlefoodtruck-uploads-prod/';
	var TRUCK_BASE = 'https://www.seattlefoodtruck.com/food-trucks/';
	var OCCIDENTAL_PARK_LOCATION_ID = 39;
	var OCCIDENTAL_PARK_SCHEDULE_URL = 'https://www.seattlefoodtruck.com/api/events';

	var tomorrow = new Date(date.getTime());
	tomorrow.setDate(tomorrow.getDate() + 1);

	var params = {
		page_size: 300,
		page: 1,
		with_active_trucks: true,
		include_bookings: true,
		with_booking_status: 'approved',
		for_locations: OCCIDENTAL_PARK_LOCATION_ID,
		start_date: formatApiDate(date),
		end_date: formatApiDate(tomorrow)
	};

	var url = OCCIDENTAL_PARK_SCHEDULE_URL + '?' + querystring.stringify(params);
	request({url: url, json: true}, function(err, schedule_resp, result) {
		if (err) {
			callback(err, null);
			return;
		}

		var trucks = [];
		result.events.forEach(function(event) {
			event.bookings.forEach(function(booking) {
				var title = booking.truck.name;
				if (booking.truck.id in EMOJI_MAP)
				{
					title = util.format('%s %s', EMOJI_MAP[booking.truck.id], title);
				}

				var attachment = {
					title: title,
					title_link: TRUCK_BASE + booking.truck.id
				};

				if (booking.truck.featured_photo)
				{
					attachment.thumb_url = IMAGE_BASE + booking.truck.featured_photo;
				}
				trucks.push(attachment);
			});
		});

		if (trucks.length > 0)
		{
			var messages = [getMessage({ text: ":bell: *Food trucks* in Occidental Park today (*" + formatDate(date) + "*), according to <https://www.seattlefoodtruck.com/schedule/occidental-park|seattlefoodtruck.com>" })];
			trucks.forEach(function(attachment) {
		 		messages.push(getMessage({ attachments: [attachment] }));
			});
			messages.push(getMessage({ text: "(Feedback &amp; feature requests can be directed to Jørgen Tjernø <mailto:jorgenpt@gmail.com|&lt;jorgenpt@gmail.com&gt;>)" }));

			callback(null, messages);
		}
		else
		{
			callback(null, []);
		}

	});
};

module.exports = {
	fetchBellevueTrucks: fetchBellevueTrucks,
	fetchOccidentalParkTrucks: fetchOccidentalParkTrucks,
};

if (require.main == module)
{
	var date = new Date();
	fetchBellevueTrucks(date.getDay(), function(err, messages) {
		if (err)
		{
			console.error("Failed to load " + BELLEVUE_SCHEDULE_URL + ": ", err);
		}
		else if (messages.length > 0)
		{
			for (var i = 0; i < endpoints.bellevue.length; ++i)
				processRequestQueue(endpoints.bellevue[i], messages.slice());
		}
		else
		{
			console.log("No Bellevue trucks for ", date);
		}
	});

	fetchOccidentalParkTrucks(date, function(err, messages) {
		if (err)
		{
			console.error("Failed to load Occidental Park schedule: ", err);
		}
		else if (messages.length > 0)
		{
			for (var i = 0; i < endpoints.occidental.length; ++i)
				processRequestQueue(endpoints.occidental[i], messages.slice());
		}
		else
		{
			console.log("No Occidental Park trucks for ", date);
		}
	});
}
