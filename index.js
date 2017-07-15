var express = require('express');

var trucks = require('./trucks');

var app = express();
app.set('port', (process.env.PORT || 5000));
app.get('/', function(req, response) {
	return response.sendStatus(401);
});

app.get('/bellevue/:day', function(req, response, next) {
	trucks.fetchBellevueTrucks(req.params.day, function(err, messages)
	{
		if (err)
			next(err);
		else
			response.send(messages);
	});
});

app.get('/occidental/:year/:month/:day', function(req, response, next) {
	trucks.fetchOccidentalParkTrucks(new Date(req.params.year, (req.params.month | 0) - 1, req.params.day), function(err, messages)
	{
		if (err)
			next(err);
		else
			response.send(messages);
	});
});

app.listen(app.get('port'), function() {
	console.log('Node app is running on port', app.get('port'));
});
