const video = document.getElementById('video');
const emotionResult = document.getElementById('emotion-result');
const locationResult = document.getElementById('location-result');
let map; // Variable to hold the map instance

// --- 1. Load AI Models ---
// This function loads all the necessary models for face detection and emotion recognition.
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'), // Not used for emotion but good to have
    faceapi.nets.faceExpressionNet.loadFromUri('/models')
]).then(startApp);

function startApp() {
    console.log("AI Models Loaded!");
    startVideo();
    getGeoLocation();
}

// --- 2. Access Camera ---
// This function gets access to the user's camera.
function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
        })
        .catch(err => {
            console.error("Error accessing camera: ", err);
            alert("Could not access the camera. Please allow camera permissions.");
        });
}

// --- 3. Get Geolocation and Display Map ---
// This function gets the user's latitude and longitude.
function getGeoLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showPosition, showError);
    } else {
        locationResult.innerText = "Geolocation is not supported by this browser.";
    }
}

function showPosition(position) {
    const lat = position.coords.latitude.toFixed(4);
    const lon = position.coords.longitude.toFixed(4);
    locationResult.innerText = `Lat: ${lat}, Lon: ${lon}`;

    // Initialize and display the map using Leaflet.js
    map = L.map('map').setView([lat, lon], 13); // Set view to user's location with zoom level 13

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    L.marker([lat, lon]).addTo(map)
        .bindPopup('You are here!')
        .openPopup();
}

function showError(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            locationResult.innerText = "Location access denied.";
            break;
        case error.POSITION_UNAVAILABLE:
            locationResult.innerText = "Location information is unavailable.";
            break;
        case error.TIMEOUT:
            locationResult.innerText = "The request to get user location timed out.";
            break;
        case error.UNKNOWN_ERROR:
            locationResult.innerText = "An unknown error occurred.";
            break;
    }
}

// --- 4. Real-time Emotion Detection ---
// This is the core function that runs continuously.
video.addEventListener('play', () => {
    // Create a canvas to draw on, and match its size to the video
    const canvas = faceapi.createCanvasFromMedia(video);
    document.querySelector('.video-container').append(canvas);
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
        // Detect faces with landmarks and expressions
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions();

        if (detections.length > 0) {
            // Get the main detected expression
            const expressions = detections[0].expressions;
            const primaryEmotion = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
            
            // Capitalize the first letter for better display
            const emotionText = primaryEmotion.charAt(0).toUpperCase() + primaryEmotion.slice(1);
            emotionResult.innerText = emotionText;
            
            // Laughing is not a default category, but a strong 'happy' is a good proxy.
            if (primaryEmotion === 'happy' && expressions.happy > 0.9) {
                 emotionResult.innerText = 'Laughing! 😄';
            }
            // Anxiety is complex, but 'fearful' or 'sad' can be indicators.
            if (primaryEmotion === 'fearful') {
                 emotionResult.innerText = 'Anxious / Fearful 😟';
            }

        } else {
            emotionResult.innerText = 'No Face Detected';
        }

        // Clear the canvas and draw new detections (optional, but cool!)
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

    }, 100); // Run detection every 100 milliseconds
});