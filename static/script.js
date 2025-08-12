// Tab navigation
        function openTab(tabName) {
            const tabContents = document.getElementsByClassName('tab-content');
            for (let i = 0; i < tabContents.length; i++) {
                tabContents[i].classList.remove('active');
            }
            
            const tabs = document.getElementsByClassName('tab');
            for (let i = 0; i < tabs.length; i++) {
                tabs[i].classList.remove('active');
            }
            
            document.getElementById(tabName).classList.add('active');
            event.currentTarget.classList.add('active');
            
            if (tabName === 'historyTab') {
                loadHistory();
            }
        }

        // Video recording functionality
        const videoPreview = document.getElementById('videoPreview');
        const startVideoBtn = document.getElementById('startVideoBtn');
        const stopVideoBtn = document.getElementById('stopVideoBtn');
        const transcribeVideoBtn = document.getElementById('transcribeVideoBtn');
        const downloadVideoBtn = document.getElementById('downloadVideoBtn');
        const cameraSelect = document.getElementById('cameraSelect');
        
        let mediaRecorder;
        let recordedChunks = [];
        let videoFileName;

        startVideoBtn.addEventListener('click', async () => {
            try {
                const constraints = {
                    video: {
                        facingMode: cameraSelect.value
                    },
                    audio: true
                };
                
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                videoPreview.srcObject = stream;
                videoPreview.play();
                
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        recordedChunks.push(event.data);
                    }
                };
                
                mediaRecorder.onstop = () => {
                    const blob = new Blob(recordedChunks, { type: 'video/webm' });
                    recordedChunks = [];
                    
                    // Convert webm to mp4 and upload
                    const formData = new FormData();
                    formData.append('file', blob, 'recording.webm');
                    
                    fetch('/upload', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            videoFileName = data.filename;
                            transcribeVideoBtn.disabled = false;
                            downloadVideoBtn.disabled = false;
                        } else {
                            alert('Error saving video: ' + (data.error || 'Unknown error'));
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('Error saving video');
                    });
                };
                
                mediaRecorder.start();
                startVideoBtn.disabled = true;
                stopVideoBtn.disabled = false;
            } catch (error) {
                console.error('Error accessing camera:', error);
                alert('Could not access camera: ' + error.message);
            }
        });

        stopVideoBtn.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                videoPreview.srcObject.getTracks().forEach(track => track.stop());
                startVideoBtn.disabled = false;
                stopVideoBtn.disabled = true;
            }
        });

        transcribeVideoBtn.addEventListener('click', () => {
            if (!videoFileName) return;
            
            fetch('/transcribe_video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ filename: videoFileName })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const resultDiv = document.getElementById('videoTranscriptionResult');
                    resultDiv.innerHTML = `
                        <h3>Transcription Result:</h3>
                        <textarea id="videoTranscriptionText" readonly>${data.text}</textarea>
                        <button onclick="copyToClipboard('videoTranscriptionText')">Copy Text</button>
                    `;
                } else {
                    alert('Error transcribing video: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error transcribing video');
            });
        });

        downloadVideoBtn.addEventListener('click', () => {
            if (!videoFileName) return;
            window.open(`/uploads/${videoFileName}`, '_blank');
        });

        // Audio recording functionality
        const startAudioBtn = document.getElementById('startAudioBtn');
        const stopAudioBtn = document.getElementById('stopAudioBtn');
        const transcribeAudioBtn = document.getElementById('transcribeAudioBtn');
        const downloadAudioBtn = document.getElementById('downloadAudioBtn');
        const audioVisualizer = document.getElementById('audioVisualizer');
        
        let audioRecorder;
        let audioChunks = [];
        let audioFileName;
        let audioContext;
        let analyser;
        let dataArray;
        let canvas;
        let canvasCtx;
        let animationId;

        startAudioBtn.addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                // Set up audio visualization
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);
                analyser.fftSize = 256;
                
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
                
                // Create canvas for visualization if it doesn't exist
                if (!canvas) {
                    canvas = document.createElement('canvas');
                    canvas.width = audioVisualizer.offsetWidth;
                    canvas.height = audioVisualizer.offsetHeight;
                    audioVisualizer.appendChild(canvas);
                    canvasCtx = canvas.getContext('2d');
                }
                
                function draw() {
                    animationId = requestAnimationFrame(draw);
                    analyser.getByteFrequencyData(dataArray);
                    
                    canvasCtx.fillStyle = 'rgb(200, 200, 200)';
                    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    const barWidth = (canvas.width / bufferLength) * 2.5;
                    let x = 0;
                    
                    for (let i = 0; i < bufferLength; i++) {
                        const barHeight = dataArray[i] / 2;
                        
                        canvasCtx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
                        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                        
                        x += barWidth + 1;
                    }
                }
                
                draw();
                
                audioRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                
                audioRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };
                
                audioRecorder.onstop = () => {
                    cancelAnimationFrame(animationId);
                    const blob = new Blob(audioChunks, { type: 'audio/webm' });
                    audioChunks = [];
                    
                    // Convert webm to mp3 and upload
                    const formData = new FormData();
                    formData.append('file', blob, 'recording.webm');
                    
                    fetch('/upload', {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            audioFileName = data.filename;
                            transcribeAudioBtn.disabled = false;
                            downloadAudioBtn.disabled = false;
                            
                            if (data.text) {
                                const resultDiv = document.getElementById('audioTranscriptionResult');
                                resultDiv.innerHTML = `
                                    <h3>Transcription Result:</h3>
                                    <textarea id="audioTranscriptionText" readonly>${data.text}</textarea>
                                    <button onclick="copyToClipboard('audioTranscriptionText')">Copy Text</button>
                                `;
                            }
                        } else {
                            alert('Error saving audio: ' + (data.error || 'Unknown error'));
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('Error saving audio');
                    });
                };
                
                audioRecorder.start();
                startAudioBtn.disabled = true;
                stopAudioBtn.disabled = false;
            } catch (error) {
                console.error('Error accessing microphone:', error);
                alert('Could not access microphone: ' + error.message);
            }
        });

        stopAudioBtn.addEventListener('click', () => {
            if (audioRecorder && audioRecorder.state !== 'inactive') {
                audioRecorder.stop();
                audioRecorder.stream.getTracks().forEach(track => track.stop());
                startAudioBtn.disabled = false;
                stopAudioBtn.disabled = true;
            }
        });

        transcribeAudioBtn.addEventListener('click', () => {
            if (!audioFileName) return;
            
            fetch('/transcribe_video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ filename: audioFileName })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const resultDiv = document.getElementById('audioTranscriptionResult');
                    resultDiv.innerHTML = `
                        <h3>Transcription Result:</h3>
                        <textarea id="audioTranscriptionText" readonly>${data.text}</textarea>
                        <button onclick="copyToClipboard('audioTranscriptionText')">Copy Text</button>
                    `;
                } else {
                    alert('Error transcribing audio: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error transcribing audio');
            });
        });

        downloadAudioBtn.addEventListener('click', () => {
            if (!audioFileName) return;
            window.open(`/uploads/${audioFileName}`, '_blank');
        });

        // History functionality
        function loadHistory() {
            fetch('/history')
                .then(response => response.json())
                .then(data => {
                    const historyList = document.getElementById('historyList');
                    historyList.innerHTML = '';
                    
                    if (data.length === 0) {
                        historyList.innerHTML = '<p>No history available</p>';
                        return;
                    }
                    
                    data.forEach(item => {
                        const historyItem = document.createElement('div');
                        historyItem.className = 'history-item';
                        
                        const date = new Date(parseInt(item.timestamp.slice(9, 13)), 
                                          parseInt(item.timestamp.slice(5, 7))-1, 
                                          parseInt(item.timestamp.slice(7, 9)));
                        
                        historyItem.innerHTML = `
                            <h4>${item.type.toUpperCase()} - ${date.toLocaleString()}</h4>
                            <p>${item.text}</p>
                            <button onclick="playRecording('${item.filename}', '${item.type}')">Play</button>
                            <button onclick="copyToClipboardFromHistory('${item.text}')">Copy Text</button>
                        `;
                        historyList.appendChild(historyItem);
                    });
                })
                .catch(error => {
                    console.error('Error loading history:', error);
                });
        }

        // Utility functions
        function copyToClipboard(elementId) {
            const textarea = document.getElementById(elementId);
            textarea.select();
            document.execCommand('copy');
            alert('Text copied to clipboard');
        }

        function copyToClipboardFromHistory(text) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('Text copied to clipboard');
        }

        function playRecording(filename, type) {
            if (type === 'video') {
                window.open(`/uploads/${filename}`, '_blank');
            } else {
                const audio = new Audio(`/uploads/${filename}`);
                audio.play();
            }
        }