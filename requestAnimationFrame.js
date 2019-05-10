let lastTime = 0
const requestAnimationFrame = callback => {
  const currTime = new Date().getTime()
  const timeToCall = Math.max(0, 16 - (currTime - lastTime))
  const id = setTimeout(() => callback(currTime + timeToCall), timeToCall)
  lastTime = currTime + timeToCall
  return id
}

module.exports = requestAnimationFrame

