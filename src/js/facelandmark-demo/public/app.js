import vision from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3'

const {FaceLandmarker, FilesetResolver, DrawingUtils} = vision

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
    console.log('querying devicess')
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter(device => device.kind === 'videoinput')

    // Log available video devices to the console
    console.log('Video devices:', videoDevices)

    const preferred = videoDevices.find(device => device.label.includes('FaceTime'))

    if (preferred) return preferred.deviceId

    // Example: Select the first video device (if available)
    if (videoDevices.length > 0) {
      const deviceId = videoDevices[0].deviceId
      return deviceId
    }
  } catch (error) {
    console.error('Error enumerating devices:', error)
  }
}

// Enable the live webcam view and start detection
async function enableCam(event) {
  console.log('enabl click!')
  if (!faceLandmarker) {
    console.log('Wait! faceLandmarker not loaded yet.')
    return
  }

  // getUsermedia parameters
  const constraints = {
    video: {
      deviceId: {exact: await getPreferredDevice()},
    },
  }

  console.log('getting user media')
  // Activate the webcam stream
  navigator.mediaDevices.getUserMedia(constraints).then(stream => {
    console.log('Activating stream!!')
    video.srcObject = stream
    video.addEventListener('loadeddata', predictWebcam)
  })

  // Hide the #ui element.
  const ui = document.getElementById('ui')
  ui.style.display = 'none'
  viz.style.display = 'block'
}

const faceImage = new Image()
faceImage.src = 'aang.avif' // Path to your faceImage image

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
  // canvasCtx.drawImage(video, 0, 0, canvasElement.width, canvasElement.height)

  if (results.faceLandmarks?.length) {
    // Assuming we're working with the first detected face for simplicity
    const landmarks = results.faceLandmarks[0]

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

    // Draw all the bounding boxes
    // drawRect(canvasElement, canvasCtx, faceBoundingBox, 'green')
    // drawRect(canvasElement, canvasCtx, leftEyeBoundingBox, 'blue')
    // drawRect(canvasElement, canvasCtx, rightEyeBoundingBox, 'blue')
    // drawRect(canvasElement, canvasCtx, mouthBoundingBox, 'red')
    // drawRect(canvasElement, canvasCtx, noseBoundingBox, 'yellow')

    const mouthHeightPercent = mouthBoundingBox.height / faceBoundingBox.height

    // Allow 10% mouth height, but every 1% increase in mouth height, displace the drawn jaw by that amount.
    const minJawDisplacement = faceBoundingBox.height * 0.1
    const observedJawDisplacement = mouthBoundingBox.height

    const mouthStartY = mouthBoundingBox.yCenter - mouthBoundingBox.height / 2
    const jawDisplacement = Math.max(minJawDisplacement, observedJawDisplacement * 1.3)

    const faceImageWidth = faceImage.width
    const faceImageHeight = faceImage.height
    const targetWidth = faceBoundingBox.width * canvasElement.width
    const targetHeight = faceBoundingBox.height * canvasElement.height

    const scale = Math.max(targetWidth / faceImageWidth, targetHeight / faceImageHeight) * 1.4
    const displayWidth = faceImageWidth * scale
    const displayHeight = faceImageHeight * scale

    // Draw the image on the canvas at the face bounding box position, scaled to the face size.
    const faceImageX = faceBoundingBox.xCenter * canvasElement.width - displayWidth / 2
    const faceImageY = faceBoundingBox.yCenter * canvasElement.height - displayHeight / 2

    console.log('Drawing face image at:', faceImageX, faceImageY)
    canvasCtx.drawImage(faceImage, faceImageX, faceImageY, displayWidth, displayHeight)

    // Draw the jaw image on the canvas at the mouth bounding box position, scaled to the mouth size.
    const targetJawWidth = mouthBoundingBox.width * canvasElement.width
    const targetJawHeight = minJawDisplacement * canvasElement.height
    const jawScale =
      Math.max(targetJawWidth / jawImage.width, targetJawHeight / jawImage.height) * 1.4
    const jawDisplayWidth = jawImage.width * jawScale
    const jawDisplayHeight = jawImage.height * jawScale

    const jawImageX = mouthBoundingBox.xCenter * canvasElement.width - jawDisplayWidth / 2
    const jawImageY = (mouthStartY + jawDisplacement) * canvasElement.height - jawDisplayHeight / 2
    console.log('Drawing jaw image at:', jawImageX, jawImageY)
    canvasCtx.drawImage(jawImage, jawImageX, jawImageY, jawDisplayWidth, jawDisplayHeight)
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
