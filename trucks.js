var $ = require('cheerio');
var request = require('request')

var SLACK_ENDPOINT = '***REMOVED***';
var SCHEDULE_URL = 'http://bellevue.com/food-truck.php';
var DAY_MAPPING = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday'
];

request(SCHEDULE_URL, function(err, schedule_resp, html) {
	if (err) {
		console.error("Failed to load " + SCHEDULE_URL + ": ", err);
		return;
	}
	var day = DAY_MAPPING[new Date().getDay()];
	var parsedHTML = $.load(html)
	var link = parsedHTML('a[name=' + day + ']');
	var truck_cells = link.parent().parent().next().find('tr').eq(1).find('td');
	var attachments = truck_cells.map(function(i, el) { return { image_url: 'http://bellevue.com/' + $(el).find('img').attr('src'), title: $(el).find('strong').text() }; }).get();

	attachments.sort(function(a, b) {
	  	if (a.title < b.title)
		    return -1;
		if (a.title > b.title)
		    return 1;
		return 0;
	});

	var message = {
		channel: req.query.channel_name,
		attachments: attachments,
	};

	request.post({ uri: SLACK_ENDPOINT, json: true, body: message }, function(err, slack_resp, html) {
		if (err)
			console.error("Failed to submit to " + SLACK_ENDPOINT + ": ", message, err);
		else
			console.log("Submitted trucks to " + SLACK_ENDPOINT + ": ", message);
	});
});
