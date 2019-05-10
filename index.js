// This is the javascript port of CommandLineFPS by javidx9: https://github.com/OneLoneCoder/CommandLineFPS

const keypress = require('keypress');
const Jetty = require('jetty')
const { performance } = require('perf_hooks')
const requestAnimationFrame = require('./requestAnimationFrame')

const jetty = new Jetty(process.stdout)

keypress(process.stdin)
jetty.clear()

const screen = []
let bullets = []
const depthBuffer = []

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
const bulletHeight = 5
const bulletWidth = 10
const FOV = 3.14159 / 4.0
const depth = 16.0
const speed = 5.0

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

		if (key.name === 'space') {
			const noise = (Math.random() - 0.5) * 0.1
			const vx = Math.sin(playerA + noise) * 8.0;
			const vy = Math.cos(playerA + noise) * 8.0;
			bullets.push({ x: playerX, y: playerY, vx, vy })
		}
	})

	process.stdin.setRawMode(true)
	process.stdin.resume()
}

const getBulletChar = (x, y) => {
	const newX = parseInt(x * bulletWidth)
	const newY = parseInt(y * bulletHeight)
	if (newY === parseInt(bulletHeight / 2) && (newX === parseInt(bulletWidth / 2) || newX === parseInt(bulletWidth / 2) - 1)) {
		return '*'
	}

	return ' '
}

const mainLoop = () => {
	t2 = performance.now()
	elapsedTime = (t2 - t1) / 1000
	t1 = t2
	jetty.moveTo([0,0])
	jetty.text(`X=${playerX.toFixed(2)} Y=${playerY.toFixed(2)} A=${playerA.toFixed(2)} FPS=${(1.0/elapsedTime).toFixed(2)}\n`)

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

		depthBuffer[x] = distanceToWall

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

	bullets.forEach(bullet => {
		// Can object be seen?
		const vecX = bullet.x - playerX
		const vecY = bullet.y - playerY
		const distanceFromPlayer = Math.sqrt(vecX * vecX + vecY * vecY)

		const eyeX = Math.sin(playerA)
		const eyeY = Math.cos(playerA)

		let objectAngle = parseFloat(Math.atan2(eyeY, eyeX)) - parseFloat(Math.atan2(vecY, vecX))
		if (objectAngle < -3.14159) {
			objectAngle += 2.0 * 3.14159
		}

		if (objectAngle > 3.14159) {
			objectAngle -= 2.0 * 3.14159
		}

		const inPlayerFOV = Math.abs(objectAngle) < (FOV / 2.0)
		if (inPlayerFOV && distanceFromPlayer >= 0.5 && distanceFromPlayer < depth && !bullet.remove) {
			const objectCeiling = parseInt(parseFloat(screenHeight / 2.0) - ((screenHeight / 2.0) / parseFloat(distanceFromPlayer)))
			const objectFloor = screenHeight - objectCeiling
			const objectHeight = parseInt(objectFloor - objectCeiling)
			const objectAspectRatio = parseFloat(bulletHeight / bulletWidth)
			const objectWidth = parseInt(objectHeight / objectAspectRatio)
			const middleOfObject = (0.5 * (objectAngle / (FOV / 2.0)) + 0.5) * parseFloat(screenWidth)
			for (let lx = 0; lx < objectWidth; lx++) {
				for (let ly = 0; ly < objectHeight; ly++) {
					const sampleX = parseFloat(lx / objectWidth)
					const sampleY = parseFloat(ly / objectHeight)
					const char = getBulletChar(sampleX, sampleY)
					const objectColumn = parseInt(middleOfObject + lx - (objectWidth / 2.0))
					if (objectColumn >= 0 && objectColumn < screenWidth) {
						if (char !== ' ' && depthBuffer[objectColumn] >= distanceFromPlayer) {
							screen[objectColumn + (parseInt(objectCeiling + ly) * screenWidth)] = char
							depthBuffer[objectColumn] = distanceFromPlayer
						}
					}
				}
			}
		}
		screen[parseInt(bullet.x) * screenWidth + parseInt(bullet.y)] = '*'
	})

	bullets = bullets.map(bullet => {
		bullet.x += bullet.vx * elapsedTime
		bullet.y += bullet.vy * elapsedTime
		if (map[parseInt(bullet.x) * mapWidth + parseInt(bullet.y)] === '#') {
			bullet.remove = true
		}

		return bullet
	}).filter(bullet => !bullet.remove)

	for (let y = 0; y < screenHeight; y++) {
		jetty.text(screen.slice(y * screenWidth, (y + 1) * screenWidth).join(''))
		jetty.text('\n')
	}

	const requestId = requestAnimationFrame(mainLoop)
}

initEvents()
mainLoop()
