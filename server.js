var express = require('express');
var socket = require('socket.io');

// App setup
var app = express();
var server = app.listen(4000, function() {
	console.log('Server is running on port 4000');
});

// Static files
app.use(express.static('public'));

// Socket setup
var io = socket(server); // Waiting for client. Listen out for when the connection is made..

// Classes
var Player = require('./classes/player.js');
var Zombie = require('./classes/zombie.js');

const WORLD_WIDTH = 100;
const WORLD_HEIGHT = 100;
const ZOMBIES = 1;

let players = [];
let zombies = [];
let messages = [];
let timeouts = [];

let sendData = false;

let storedZombies = [];

let i = 0;

setInterval(function() {
	storedZombies = zombies; // store the zombies in storedZombies
	for (let zombie of zombies) { // loop through each zombie


		zombie.findTarget(players); // find nearest player
		zombie.moveTowardsTarget(); // move if target is set (zombie is changed)



		for (let i = 0; i < storedZombies.length; i++) {
			if (storedZombies[i].x != zombies[i].x) {
				sendData = true;
			}
		}


	}

}, 33);

/*setInterval(function() { // Zombie data
	storedZombies = zombies;

	for (const zombie of zombies) {
		zombie.findTarget(players);
		zombie.moveTowardsTarget();

		for (let i = 0; i < storedZombies.length; i++) {
			if (zombies[i].x != storedZombies[i].x) {
				sendData = true;
			}
		}

	}
	if (sendData) {
		console.log("sent some data" + ++i);
		sendData = false;
		io.sockets.emit('zombie_update', zombies);
	}
}, 33);*/

initZombies();

function initZombies() {
	for (let i = 0; i < ZOMBIES; i++) {
		let zombie = new Zombie({
			x: Math.random() * WORLD_WIDTH,
			y: Math.random() * WORLD_HEIGHT,
			angle: 0,
			size: 20,
			health: 20,
			speed: 5,
			spotRange: 50
		});
		zombies.push(zombie);
	}
}

io.on('connection', function(socket) {
	socket.on('new_player', function(data) {
		let player = new Player({
			id: socket.id,
			x: data.x,
			y: data.y,
			size: data.size,
			name: data.name,
			health: data.health,
			angle: 0,
			color: data.color
		});
		players.push(player);

		io.sockets.emit('client_ids', players); // Emit data because all clients need to see new client..
		io.sockets.emit('zombie_update', zombies);

		socket.emit('handshake', socket.id); // So the client can tell what id they are..

		console.log(socket.id + " joined. (" + players.length + " players total)");
	});

	socket.on('player_update', function(data) {
		for (let player of players) {
			if (player.id != socket.id) continue; // This is how we tell which player to update..
			player.x = data.x;
			player.y = data.y;
			player.health = data.health;
			player.angle = data.angle;
		}
		io.sockets.emit('client_ids', players);
	});

	socket.on('text', function(data) {
		let message = new Message(data.id, data.text);
		for (let message of messages) { // Remove dupelicate messages.
			if (message.id != data.id) continue;
			let index = messages.indexOf(message);
			messages.splice(index, 1);
		}

		for (let timeout of timeouts) { // Remove previous timeout for previous sent message if any
			if (timeout.id != data.id) continue;
			clearTimeout(timeout.timeout);
		}

		message.initLife(); // Start message lifetime..
		messages.push(message);

		io.sockets.emit('messages', messages); // Only emit data if needed like on this line but not every 33 ms!!
	});

	socket.on('disconnect', function() {
		for (const player of players) {
			if (player.id != socket.id) continue;
			const index = players.indexOf(player);
			players.splice(index, 1);
		}

		io.sockets.emit('client_ids', players); // Emit data because all clients no longer need to see old client..

		console.log(socket.id + " left. (" + players.length + " players total)");
	});
});

function Message(id, text) {
	this.id = id;
	this.text = text;

	this.initLife = function() {
		let timeout = setTimeout(
			function() {
				for (const message of messages) {
					if (message.id != id) continue;
					let index = messages.indexOf(message);
					messages.splice(index, 1);
					io.sockets.emit('messages', messages); // Update for all other clients..
				}
			}, 6000); // lifetime in ms of message being displayed..
		timeouts.push({
			timeout: timeout,
			id: id
		});
	}
}