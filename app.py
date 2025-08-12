import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
import speech_recognition as sr
from pydub import AudioSegment
import tempfile

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Store transcription history in memory (for demo)
transcription_history = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Save the file with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    if file.content_type.startswith('video'):
        ext = 'mp4'
    else:
        ext = 'mp3'
    
    filename = f"{timestamp}.{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    
    # Convert to WAV for speech recognition if it's audio
    if file.content_type.startswith('audio'):
        try:
            # Convert to WAV
            audio = AudioSegment.from_file(filepath)
            wav_path = os.path.join(UPLOAD_FOLDER, f"{timestamp}.wav")
            audio.export(wav_path, format="wav")
            
            # Transcribe
            recognizer = sr.Recognizer()
            with sr.AudioFile(wav_path) as source:
                audio_data = recognizer.record(source)
                text = recognizer.recognize_google(audio_data)
                
            # Save to history
            transcription_history.append({
                'filename': filename,
                'text': text,
                'timestamp': timestamp,
                'type': 'audio'
            })
            
            return jsonify({
                'success': True,
                'text': text,
                'filename': filename
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'success': True, 'filename': filename})

@app.route('/transcribe_video', methods=['POST'])
def transcribe_video():
    if 'filename' not in request.json:
        return jsonify({'error': 'No filename provided'}), 400
    
    filename = request.json['filename']
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    
    try:
        # Extract audio from video
        video = AudioSegment.from_file(filepath, format="mp4")
        wav_path = os.path.join(UPLOAD_FOLDER, f"{filename.split('.')[0]}.wav")
        video.export(wav_path, format="wav")
        
        # Transcribe
        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
        
        # Save to history
        transcription_history.append({
            'filename': filename,
            'text': text,
            'timestamp': filename.split('.')[0],
            'type': 'video'
        })
        
        return jsonify({
            'success': True,
            'text': text
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/history', methods=['GET'])
def get_history():
    return jsonify(transcription_history)

if __name__ == '__main__':
    app.run(debug=True)