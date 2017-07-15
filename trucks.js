var $ = require('cheerio');
var request = require('request')

var SLACK_ENDPOINTS = [
	'***REMOVED***', // Uber
	'***REMOVED***', // EnvelopVR
	'***REMOVED***', // Epic Games
];

if (false)
	SLACK_ENDPOINTS = ['***REMOVED***']; // Testing.

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

var processRequestQueue = function(endpoint, queue)
{
	if (queue.length < 1)
	{
		console.log("Submitted full queue to " + endpoint);
		return;
	}

	var message = queue.shift();
	request.post({ uri: endpoint, json: true, body: message }, function(err, slack_resp, html) {
		if (err)
			console.error("Failed to submit to " + endpoint + ": ", message, err);
		else
			processRequestQueue(endpoint, queue);
	});
};

var BELLEVUE_SCHEDULE_URL = 'http://bellevue.com/food-truck.php';
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
		return;

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

module.exports = {
	fetchBellevueTrucks: fetchBellevueTrucks,
};

if (require.main == module)
{
	fetchBellevueTrucks(new Date().getDay(), function(err, messages) {
		if (err)
		{
			console.error("Failed to load " + BELLEVUE_SCHEDULE_URL + ": ", err);
		}
		else
		{
			for (var i = 0; i < SLACK_ENDPOINTS.length; ++i)
				processRequestQueue(SLACK_ENDPOINTS[i], messages.slice());
		}
	});
}
