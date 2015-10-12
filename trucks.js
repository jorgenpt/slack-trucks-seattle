var $ = require('cheerio');
var request = require('request')

var SLACK_ENDPOINTS = [
	'***REMOVED***', // Uber
	'***REMOVED***', // EnvelopVR
	'***REMOVED***', // Epic Games
];

if (false)
	SLACK_ENDPOINTS = ['***REMOVED***']; // Testing.

var SCHEDULE_URL = 'http://bellevue.com/food-truck.php';

var DAY_MAPPING = {
	1: 'Monday',
	2: 'Tuesday',
	3: 'Wednesday',
	4: 'Thursday',
	5: 'Friday',
};

var dayOfWeek = new Date().getDay();
if (!(dayOfWeek in DAY_MAPPING))
	return;

var day = DAY_MAPPING[dayOfWeek];

request(SCHEDULE_URL, function(err, schedule_resp, html) {
	if (err) {
		console.error("Failed to load " + SCHEDULE_URL + ": ", err);
		return;
	}
	var parsedHTML = $.load(html)
	var link = parsedHTML('a[name=' + day + ']');
	var truck_cells = link.parent().parent().next().find('tr').eq(1).find('td');
	var attachments = truck_cells.map(function(i, el) {
		return {
			thumb_url: 'http://bellevue.com/' + $(el).find('img').attr('src'),
			title: $(el).find('strong').text(),
			title_link: 'http://bellevue.com/' + $(el).find('a').attr('href')
		}
	}).get();

	attachments.sort(function(a, b) {
	  	if (a.title < b.title)
		    return -1;
		if (a.title > b.title)
		    return 1;
		return 0;
	});

	var message = {
		icon_emoji: ':truck:',
		username: 'trucks',
		text: ":bell: *Food trucks* in front of Barnes & Noble today (*" + day + "*), according to <http://bellevue.com/food-truck.php|bellevue.com>",
		attachments: attachments,
	};

	var summaryMessage = {
		icon_emoji: ':truck:',
		username: 'trucks',
		text: "(Feedback &amp; feature requests can be directed to Jørgen Tjernø <mailto:jorgenpt@gmail.com|&lt;jorgenpt@gmail.com&gt;>)"
	};

	for (var i = 0; i < SLACK_ENDPOINTS.length; ++i)
	{
		var endpoint = SLACK_ENDPOINTS[i];
		request.post({ uri: endpoint, json: true, body: message }, function(err, slack_resp, html) {
			if (err)
				console.error("Failed to submit to " + endpoint + ": ", message, err);
			else
			{
				request.post({ uri: endpoint, json: true, body: summaryMessage }, function(err, slack_resp, html) {
					console.log("Submitted trucks to " + endpoint + ": ", message);
				});
			}
		});
	}
});
