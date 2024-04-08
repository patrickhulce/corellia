import vision from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3'

const {FaceLandmarker, FilesetResolver, DrawingUtils} = vision

const DEBUG_MODE = window.location.search.includes('debug')

// Select the video element and the canvas for output
const video = document.getElementById('webcam')
const canvasElement = document.getElementById('output_canvas')
const canvasCtx = canvasElement.getContext('2d')

// Button to enable the webcam
const enableWebcamButton = document.getElementById('webcamButton')

let faceLandmarker

// Initialize the face landmarker
async function createFaceLandmarker() {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm',
  )
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: 'GPU',
    },
    outputFaceBlendshapes: false, // Set to false as we're not using blendshapes in this example
    runningMode: 'VIDEO',
    numFaces: 1,
  })
}

createFaceLandmarker()

// Check if webcam access is supported
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
}

async function getPreferredDevice() {
  try {
    console.log('Enumerating video devices...')
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter(device => device.kind === 'videoinput')

    // Log available video devices to the console
    console.log('Available video devices:', videoDevices)

    const preferred = videoDevices.find(device => device.label.includes('FaceTime'))
    return preferred?.deviceId ?? videoDevices[0].deviceId
  } catch (error) {
    console.error('Error enumerating devices:', error)
  }
}

// Enable the live webcam view and start detection
async function enableCam(event) {
  if (!faceLandmarker) {
    console.log('Wait! faceLandmarker not loaded yet.')
    return
  }

  // getUserMedia parameters
  const constraints = {
    video: {
      deviceId: {exact: await getPreferredDevice()},
    },
  }

  console.log('Getting user media with constraints:', constraints)

  // Activate the webcam stream and start our prediction loop.
  navigator.mediaDevices.getUserMedia(constraints).then(stream => {
    console.log('Playing the video stream from the selected webcam.')
    video.srcObject = stream
    video.addEventListener('loadeddata', predictWebcam)
  })

  // Hide the #ui element once we start the webcam stream.
  const ui = document.getElementById('ui')
  ui.style.display = 'none'
  viz.style.display = 'block'
}

const faceImage = new Image()
faceImage.src = 'aang.avif' // Path to your faceImage image
const faceClosedImage = new Image()
faceClosedImage.src = 'aang_closed.avif' // Path to your faceImage image with eyes closed

const jawImage = new Image()
jawImage.src = 'jaw.avif' // Path to your jaw image

/**
 * Computes the bounding box in [0-1] scale of the input image.
 */
function getBoundingBox(landmarks, selectionRanges = []) {
  let points = []
  if (selectionRanges.length) {
    for (const value of selectionRanges) {
      let range = value
      if (typeof range === 'number') range = {start: value, end: value + 1}
      points = points.concat(landmarks.slice(range.start, range.end))
    }
  } else {
    points = landmarks
  }

  const xs = points.map(lm => lm.x)
  const ys = points.map(lm => lm.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  return {
    top: yMin,
    left: xMin,
    bottom: yMax,
    right: xMax,
    xCenter: (xMin + xMax) / 2,
    yCenter: (yMin + yMax) / 2,
    width: xMax - xMin,
    height: yMax - yMin,
  }
}

function drawRect(canvas, ctx, bbox, color = 'red') {
  ctx.strokeStyle = color
  const x = (bbox.xCenter - bbox.width / 2) * canvas.width
  const y = (bbox.yCenter - bbox.height / 2) * canvas.height
  ctx.strokeRect(x, y, bbox.width * canvas.width, bbox.height * canvas.height)
}

const MOUTH = [11, 12, 186, 410, 17, 314, 84, 146, 375]
const NOSE = [1, 141, 98, 278, 6, 195, 217, 437]
const LEFT_EYE = [{start: 157, end: 161}, 161, 163, 144, 145, 154]
const RIGHT_EYE = [362, 263, {start: 380, end: 383}, {start: 384, end: 389}]

// Continuously grab image from webcam stream and detect it
async function predictWebcam() {
  if (video.readyState !== 4) {
    return
  }

  const startTimeMs = performance.now()
  const results = await faceLandmarker.detectForVideo(video, startTimeMs)

  // Match the canvas to the video
  canvasElement.width = video.videoWidth
  canvasElement.height = video.videoHeight

  if (results.faceLandmarks?.length) {
    // Assuming we're working with the first detected face for simplicity
    renderAvatarFace(results.faceLandmarks[0])
  }

  // Call this function again to keep predicting when the browser is ready
  window.requestAnimationFrame(predictWebcam)
}

// Add event listener to button for when user wants to activate the webcam
if (hasGetUserMedia()) {
  console.log('wtf')
  enableWebcamButton.addEventListener('click', enableCam)
} else {
  console.warn('getUserMedia() is not supported by your browser')
}

function renderAvatarFace(landmarks) {
  let faceBoundingBox = getBoundingBox(landmarks)
  const leftEyeBoundingBox = getBoundingBox(landmarks, LEFT_EYE)
  const rightEyeBoundingBox = getBoundingBox(landmarks, RIGHT_EYE)
  const noseBoundingBox = getBoundingBox(landmarks, NOSE)
  const mouthBoundingBox = getBoundingBox(landmarks, MOUTH)

  const eyeCenterX = (leftEyeBoundingBox.xCenter + rightEyeBoundingBox.xCenter) / 2
  const eyeCenterY = (leftEyeBoundingBox.yCenter + rightEyeBoundingBox.yCenter) / 2

  const eyeDistance = Math.abs(leftEyeBoundingBox.xCenter - rightEyeBoundingBox.xCenter)
  const eyeToNoseDistance = Math.abs(
    noseBoundingBox.yCenter + noseBoundingBox.height / 2 - eyeCenterY,
  )

  faceBoundingBox = {
    xCenter: eyeCenterX,
    yCenter: eyeCenterY,
    width: faceBoundingBox.width,
    height: faceBoundingBox.width * 1.6,
  }

  if (DEBUG_MODE) {
    drawRect(canvasElement, canvasCtx, faceBoundingBox, 'green')
    drawRect(canvasElement, canvasCtx, leftEyeBoundingBox, 'blue')
    drawRect(canvasElement, canvasCtx, rightEyeBoundingBox, 'blue')
    drawRect(canvasElement, canvasCtx, mouthBoundingBox, 'red')
    drawRect(canvasElement, canvasCtx, noseBoundingBox, 'yellow')
  }

  const context = {canvasCtx, canvasElement, image: faceImage, boundingBox: faceBoundingBox}

  // Allow 10% mouth height, but every 1% increase in mouth height, displace the drawn jaw by that amount.
  const minJawDisplacement = faceBoundingBox.height * 0.15
  const observedJawDisplacement = mouthBoundingBox.height

  const jawDisplacement = Math.max(minJawDisplacement, observedJawDisplacement * 1.3)

  drawScaledImage({label: 'face', ...context})
  drawScaledImage({
    label: 'jaw',
    ...context,
    boundingBox: mouthBoundingBox,
    image: jawImage,
    anchor: 'bottom',
    displacementFactor: minJawDisplacement,
  })
}

/**
 * Computes the arguments for drawing an image on a canvas, taking into account the bounding box of the area where the image should be drawn, the image itself, the canvas element, and optional parameters for displacement.
 *
 * @param {HTMLCanvasElement} canvasElement - The canvas element where the image will be drawn.
 * @param {Image} image - The image object to be drawn. Should contain width and height properties.
 * @param {Object} boundingBox - The bounding box within which the image is to be drawn. Should contain width, height, xCenter, and yCenter properties.
 * @param {number} [displacementFactor=0] - Optional. Factor to adjust the vertical displacement of the image. Useful for images that need to be positioned based on dynamic conditions (e.g., mouth images).
 * @param {string} [label='image'] - Optional. A label to identify the image being drawn.
 * @param {string} [anchor='center'] - Optional. The anchor point for the image. Can be 'center' or 'bottom'.
 * @returns {Object} An object containing the x and y coordinates, and the display width and height for the image to be drawn on the canvas.
 */
function drawScaledImage({
  canvasCtx,
  canvasElement,
  image,
  boundingBox,
  label = 'image',
  anchor = 'center',
  displacementFactor = 0,
}) {
  // Calculate the target width and height on the canvas based on the bounding box.
  const targetWidth = boundingBox.width * canvasElement.width
  const targetHeight = boundingBox.height * canvasElement.height

  // Determine the scale needed to fit the image within the target dimensions, adjusting by 1.4 to ensure it fully covers the area.
  const scale = Math.max(targetWidth / image.width) * 1.4
  const displayWidth = image.width * scale
  const displayHeight = image.height * scale

  // Calculate the x coordinate to center the image within the detected region.
  const imageX = boundingBox.xCenter * canvasElement.width - displayWidth / 2

  // Calculate the y coordinate (default to center) to center the image within the detected region.
  let imageY = boundingBox.yCenter * canvasElement.height - displayHeight / 2
  if (anchor === 'bottom') {
    const bottomY = boundingBox.bottom * canvasElement.height
    imageY = bottomY - displayHeight
  }
  if (displacementFactor) {
    imageY += displacementFactor * canvasElement.height
  }

  console.log(`Drawing ${label} at:`, imageX, imageY)
  canvasCtx.drawImage(image, imageX, imageY, displayWidth, displayHeight)
}
