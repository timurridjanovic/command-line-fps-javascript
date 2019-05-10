// This is the javascript port of CommandLineFPS by javidx9: https://github.com/OneLoneCoder/CommandLineFPS

const keypress = require('keypress');
const Jetty = require('jetty')
const { performance } = require('perf_hooks')
const requestAnimationFrame = require('./requestAnimationFrame')

const jetty = new Jetty(process.stdout)

keypress(process.stdin)
jetty.clear()

const screen = []
const map = (
	'################' +
	'#..............#' +
	'#..............#' +
	'#....##.....####' +
	'#..............#' +
	'#..............#' +
	'#.....##.......#' +
	'#.....##.......#' +
	'#..............#' +
	'#..............#' +
	'#........#######' +
	'#..............#' +
	'######.........#' +
	'#..............#' +
	'#..............#' +
	'################'
).trim()

const screenWidth = 120
const screenHeight = 40
const mapWidth = 16
const mapHeight = 16
const FOV = 3.14159 / 4.0
const depth = 16.0
const speed = 3.0

let playerX = 8.0
let playerY = 8.0
let playerA = 0.0

let t1 = performance.now()
let t2 = performance.now()
let elapsedTime = 0

const initEvents = () => {
	process.stdin.on('keypress', function (ch, key) {
		if (key && key.ctrl && key.name == 'c') {
			process.exit(1)
		}

		if (key.name === 'left') {
			playerA -= (speed * 0.75) * elapsedTime
		}

		if (key.name === 'right') {
			playerA += (speed * 0.75) * elapsedTime
		}

		if (key.name === 'up') {
			playerX += Math.sin(playerA) * speed * elapsedTime
			playerY += Math.cos(playerA) * speed * elapsedTime

			if (map[parseInt(playerX) * mapWidth + parseInt(playerY)] === '#') {
				playerX -= Math.sin(playerA) * speed * elapsedTime
				playerY -= Math.cos(playerA) * speed * elapsedTime
			}
		}

		if (key.name === 'down') {
			playerX -= Math.sin(playerA) * speed * elapsedTime
			playerY -= Math.cos(playerA) * speed * elapsedTime
			if (map[parseInt(playerX) * mapWidth + parseInt(playerY)] === '#') {
				playerX += Math.sin(playerA) * speed * elapsedTime
				playerY += Math.cos(playerA) * speed * elapsedTime
			}
		}
	})

	process.stdin.setRawMode(true)
	process.stdin.resume()
}

const mainLoop = () => {
	t2 = performance.now()
	elapsedTime = (t2 - t1) / 1000
	t1 = t2
	jetty.moveTo([0,0])
	jetty.text(`FPS=${parseInt(1.0/elapsedTime)}\n`)

	for (let x = 0; x < screenWidth; x++) {
		// For each column, calculate the projected ray angle into world space
		const rayAngle = (playerA - FOV / 2.0) + (x / screenWidth) * FOV

		// Find distance to wall
		const stepSize = 0.1 // Increment size for ray casting, decrease to increase
		let distanceToWall = 0.0;

		let hitWall = false // Set when ray hits wall block
		let boundary = false // Set when ray hits boundary between two wall blocks

		const eyeX = Math.sin(rayAngle) // Unit vector for ray in player space
		const eyeY = Math.cos(rayAngle)

		while (!hitWall && distanceToWall < depth) {
			distanceToWall += stepSize
			const testX = parseInt(playerX + eyeX * distanceToWall)
			const testY = parseInt(playerY + eyeY * distanceToWall)

			// Test if ray is out of bounds
			if (testX < 0 || testX >= mapWidth || testY < 0 || testY >= mapHeight) {
					hitWall = true // Just set distance to maximum depth
					distanceToWall = depth
			} else {
				if (map[testX * mapWidth + testY] === '#')	{
					hitWall = true

					const p = []
					for (let x = 0; x < 2; x++) {
						for (let y = 0; y < 2; y++) {
							const vy = parseFloat(testY) + y - playerY
							const vx = parseFloat(testX) + x - playerX
							const d = Math.sqrt(vx*vx + vy*vy)
							const dot = (eyeX * vx / d) + (eyeY * vy / d)
							p.push([d, dot])
						}
					}

					p.sort((a, b) => {
						return a[0] - b[0];
					})

					const bound = 0.01
					if (Math.acos(p[0][1]) < bound) {
						boundary = true
					}

					if (Math.acos(p[1][1]) < bound) {
						boundary = true
					}

					if (Math.acos(p[2][1]) < bound) {
						boundary = true
					}
				}
			}
		}

		const ceiling = parseInt(parseFloat(screenHeight / 2.0) - (screenHeight / parseFloat(distanceToWall)))
		const floor = parseInt(screenHeight - ceiling)

		// Shader walls based on distance
		let shade = ' '
		if (distanceToWall <= depth / 4.0) {
			shade = String.fromCharCode(9608)	// Very close
		} else if (distanceToWall < depth / 3.0) {
			shade = String.fromCharCode(9619)
		} else if (distanceToWall < depth / 2.0) {
			shade = String.fromCharCode(9618)
		} else if (distanceToWall < depth) {
			shade = String.fromCharCode(9617)
		} else {
			shade = ' ' // Too far away
		}

		if (boundary) {
			shade = ' ' // Black it out
		}

		for (let y = 0; y < screenHeight; y++) {
			// Each Row
			if (y <= ceiling) {
				screen[y * screenWidth + x] = ' '
			} else if (y > ceiling && y <= floor) {
				screen[y * screenWidth + x] = shade
			} else { // Floor
				// // Shade floor based on distance
				let floorShade = ' '
				let b = 1.0 - ((parseFloat(y) - screenHeight / 2.0) / (parseFloat(screenHeight) / 2.0))
				if (b < 0.25) {
					floorShade = '#'
				} else if (b < 0.5)	{
					floorShade = 'x'
				} else if (b < 0.75) {
					floorShade = '.'
				} else if (b < 0.9)	{
					floorShade = '-'
				} else {
					floorShade = ' '
				}

				screen[y * screenWidth + x] = floorShade
			}
		}
	}

	for (let x = 0; x < mapWidth; x++) {
		for (let y = 0; y < mapWidth; y++) {
			screen[y * screenWidth + x] = map[y * mapWidth + x]
		}
	}

	screen[parseInt(playerX) * screenWidth + parseInt(playerY)] = 'P'


	for (let y = 0; y < screenHeight; y++) {
		jetty.text(screen.slice(y * screenWidth, (y + 1) * screenWidth).join(''))
		jetty.text('\n')
	}

	const requestId = requestAnimationFrame(mainLoop)
}

initEvents()
mainLoop()
