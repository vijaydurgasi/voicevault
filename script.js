 
        // Inline GeminiService (for demonstration, replace API Key)
        class GeminiService {
            constructor() {
                // IMPORTANT: Replace 'YOUR_GEMINI_API_KEY' with your actual API Key.
                // For production, consider using a backend proxy to keep your API key secure.
                this.apiKey = 'AIzaSyBLACE8z4xpUlk2JX8oTtLHKy-T2JmIS_g'; // Updated API Key
                this.transcriptionEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${this.apiKey}`;
                this.summaryEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${this.apiKey}`;
            }

            /**
             * Transcribes audio using the Gemini AI (simulated, as direct audio transcription via
             * Gemini is typically done server-side or with specialized models/APIs).
             * For a real-world scenario, you'd send the audio to a speech-to-text API.
             * Here, it will return a placeholder or use a simple text prompt.
             * @param {Blob} audioBlob - The audio Blob to transcribe.
             * @returns {Promise<string|null>} The transcribed text or null if an error occurs.
             */
            async transcribeAudio(audioBlob) {
                if (!this.apiKey) {
                    console.warn("Gemini API Key is not configured. Cannot transcribe directly.");
                    // Provide a mock transcription if no API key is available
                    return "This is a simulated transcription of your audio. For actual audio transcription, a dedicated Speech-to-Text API or a backend service is required to process the audio file.";
                }
                
                // --- REAL API CALLS FOR AUDIO TO TEXT ARE MORE COMPLEX ---
                // Google Gemini API (generateContent) doesn't directly support audio file input
                // for transcription like this via the browser fetch API.
                // You would typically use Google Cloud Speech-to-Text API, or a service like AssemblyAI.
                // If you must use Gemini, you'd send the audio to a backend,
                // have the backend transcribe it, and then send the text to Gemini.

                // For demonstration purposes with the provided architecture,
                // we'll simulate a transcription.
                console.log('Simulating audio transcription for the provided audio blob...');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
                return `Simulated transcription of your audio file (${audioBlob.type}, ${audioBlob.size} bytes).
                Actual content: "Hello, this is a test recording for the voice summarizer application.
                I am speaking clearly so that the transcription model can capture my words accurately.
                This recording will be used to demonstrate how to convert spoken words into text,
                and then summarize that text using artificial intelligence.
                Thank you for trying out this feature."`;
            }

            /**
             * Generates a summary of the given text using Gemini AI.
             * @param {string} text - The text to summarize.
             * @returns {Promise<string|null>} The summarized text or null if an error occurs.
             */
            async generateSummary(text) {
                if (!this.apiKey) {
                    throw new Error("Gemini API Key is not configured. Cannot generate summary.");
                }

                if (!text || text.trim().length === 0) {
                    return null;
                }

                const prompt = `Please provide a concise, bullet-point summary of the following text:\n\n${text}\n\nSummary:`;

                const payload = {
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 200 // Adjust as needed for summary length
                    }
                };

                try {
                    console.log('Sending summary request to Gemini AI...');
                    const response = await fetch(this.summaryEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
                    }

                    const data = await response.json();
                    if (data && data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                        return data.candidates[0].content.parts[0].text;
                    } else {
                        console.warn('Unexpected Gemini API response structure:', data);
                        return "Failed to parse summary from AI response. Check console for details.";
                    }

                } catch (error) {
                    console.error('Error generating summary from Gemini AI:', error);
                    throw error; // Re-throw to be caught by the calling function
                }
            }
        }

        // Inline DatabaseService (using IndexedDB)
        class DatabaseService {
            constructor() {
                this.dbName = 'VoiceRecorderDB';
                this.dbVersion = 1;
                this.dbPromise = this.openDatabase();
            }

            async openDatabase() {
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open(this.dbName, this.dbVersion);

                    request.onupgradeneeded = (event) => {
                        const db = event.target.result;
                        console.log('IndexedDB upgrade needed for version:', event.oldVersion);

                        // Create object store for recordings
                        if (!db.objectStoreNames.contains('recordings')) {
                            db.createObjectStore('recordings', { keyPath: 'id', autoIncrement: true });
                        }
                        // Create object store for transcripts
                        if (!db.objectStoreNames.contains('transcripts')) {
                            db.createObjectStore('transcripts', { keyPath: 'id', autoIncrement: true });
                            const transcriptStore = request.transaction.objectStore('transcripts');
                            transcriptStore.createIndex('recordingId', 'recordingId', { unique: false });
                        }
                        // Create object store for summaries
                        if (!db.objectStoreNames.contains('summaries')) {
                            db.createObjectStore('summaries', { keyPath: 'id', autoIncrement: true });
                            const summaryStore = request.transaction.objectStore('summaries');
                            summaryStore.createIndex('transcriptId', 'transcriptId', { unique: true }); // A summary should ideally belong to one transcript
                        }
                    };

                    request.onsuccess = (event) => {
                        const db = event.target.result;
                        console.log('IndexedDB opened successfully');
                        resolve(db);
                    };

                    request.onerror = (event) => {
                        console.error('IndexedDB error:', event.target.errorCode);
                        reject(new Error('Failed to open IndexedDB: ' + event.target.errorCode));
                    };
                });
            }

            /**
             * Saves a new recording record along with its audio blob.
             * @param {Object} recordingData - Metadata for the recording (title, filename, mimeType, duration, fileSize).
             * @param {Blob} audioBlob - The actual audio Blob.
             * @returns {Promise<Object>} The saved recording object including its ID.
             */
            async saveRecording(recordingData, audioBlob) {
                const db = await this.dbPromise;
                const tx = db.transaction('recordings', 'readwrite');
                const store = tx.objectStore('recordings');

                const newRecording = {
                    ...recordingData,
                    audioBlob: audioBlob,
                    createdAt: new Date().toISOString()
                };

                const request = store.add(newRecording); // Returns an IDBRequest object

                // Explicitly wait for the request to complete and get its result
                await new Promise((resolve, reject) => {
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });

                const id = request.result; // This is the actual key (number for autoIncrement)
                console.log('ID obtained from saveRecording:', id, 'Type:', typeof id);

                await tx.done; // Ensure the transaction itself completes
                
                return { id, ...newRecording };
            }

            /**
             * Retrieves a recording by its ID.
             * @param {number} id - The ID of the recording.
             * @returns {Promise<Object|undefined>} The recording object or undefined if not found.
             */
            async getRecording(id) {
                const db = await this.dbPromise;
                const tx = db.transaction('recordings', 'readonly');
                const store = tx.objectStore('recordings');
                return store.get(id);
            }

            /**
             * Retrieves all recordings.
             * @returns {Promise<Array<Object>>} An array of all recording objects.
             */
            async getUserRecordings() {
                const db = await this.dbPromise;
                const tx = db.transaction('recordings', 'readonly');
                const store = tx.objectStore('recordings');
                return store.getAll();
            }

            /**
             * Deletes a recording by its ID.
             * @param {number} id - The ID of the recording to delete.
             * @returns {Promise<void>}
             */
            async deleteRecording(id) {
                const db = await this.dbPromise;
                const tx = db.transaction('recordings', 'readwrite');
                const store = tx.objectStore('recordings');
                await store.delete(id);
                await tx.done;
            }

            /**
             * Saves a new transcript record.
             * @param {Object} transcriptData - Metadata and content for the transcript.
             * @returns {Promise<Object>} The saved transcript object including its ID.
             */
            async saveTranscript(transcriptData) {
                const db = await this.dbPromise;
                const tx = db.transaction('transcripts', 'readwrite');
                const store = tx.objectStore('transcripts');

                const newTranscript = {
                    recordingId: transcriptData.recordingId,
                    content: transcriptData.content,
                    language: transcriptData.language,
                    confidence: transcriptData.confidence,
                    processingTime: transcriptData.processingTime,
                    createdAt: new Date().toISOString()
                };

                const id = await store.add(newTranscript);
                await tx.done;
                return { id, ...newTranscript };
            }

            /**
             * Retrieves a transcript by its recordingId.
             * @param {number} recordingId - The ID of the associated recording.
             * @returns {Promise<Object|undefined>} The transcript object or undefined if not found.
             */
            async getTranscriptByRecording(recordingId) {
                const db = await this.dbPromise;
                const tx = db.transaction('transcripts', 'readonly');
                const store = tx.objectStore('transcripts');
                const index = store.index('recordingId');
                return index.get(recordingId);
            }

            /**
             * Deletes a transcript by its ID.
             * @param {number} id - The ID of the transcript to delete.
             * @returns {Promise<void>}
             */
            async deleteTranscript(id) {
                const db = await this.dbPromise;
                const tx = db.transaction('transcripts', 'readwrite');
                const store = tx.objectStore('transcripts');
                await store.delete(id);
                await tx.done;
            }

            /**
             * Saves a new summary record.
             * @param {Object} summaryData - Metadata and content for the summary.
             * @returns {Promise<Object>} The saved summary object including its ID.
             */
            async saveSummary(summaryData) {
                const db = await this.dbPromise;
                const tx = db.transaction('summaries', 'readwrite');
                const store = tx.objectStore('summaries');

                const newSummary = {
                    ...summaryData,
                    createdAt: new Date().toISOString()
                };

                const id = await store.add(newSummary);
                await tx.done;
                return { id, ...newSummary };
            }

            /**
             * Retrieves a summary by its transcriptId.
             * @param {number} transcriptId - The ID of the associated transcript.
             * @returns {Promise<Object|undefined>} The summary object or undefined if not found.
             */
            async getSummaryByTranscript(transcriptId) {
                const db = await this.dbPromise;
                const tx = db.transaction('summaries', 'readonly');
                const store = tx.objectStore('summaries');
                const index = store.index('transcriptId');
                return index.get(transcriptId);
            }

            /**
             * Deletes a summary by its ID.
             * @param {number} id - The ID of the summary to delete.
             * @returns {Promise<void>}
             */
            async deleteSummary(id) {
                const db = await this.dbPromise;
                const tx = db.transaction('summaries', 'readwrite');
                const store = tx.objectStore('summaries');
                await store.delete(id);
                await tx.done;
            }

            /**
             * Clears all data from all object stores.
             * Use with caution.
             */
            async clearAllData() {
                const db = await this.dbPromise;
                const tx = db.transaction(['recordings', 'transcripts', 'summaries'], 'readwrite');
                await tx.objectStore('recordings').clear();
                await tx.objectStore('transcripts').clear();
                await tx.objectStore('summaries').clear();
                await tx.done;
                console.log('All IndexedDB data cleared.');
            }
        }


        // Custom Confirmation Modal Logic
        function showCustomConfirm(title, message, onConfirmCallback) {
            const modalBackdrop = document.getElementById('customConfirmModal');
            const modalTitle = document.getElementById('customConfirmTitle');
            const modalMessage = document.getElementById('customConfirmMessage');
            const confirmBtn = document.getElementById('customConfirmOK');
            const cancelBtn = document.getElementById('customConfirmCancel');

            modalTitle.textContent = title;
            modalMessage.textContent = message;

            modalBackdrop.classList.remove('hidden');
            requestAnimationFrame(() => {
                modalBackdrop.classList.add('show');
            });

            const cleanup = () => {
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                modalBackdrop.classList.remove('show');
                setTimeout(() => modalBackdrop.classList.add('hidden'), 300); // Hide after transition
            };

            const handleConfirm = () => {
                onConfirmCallback(true);
                cleanup();
            };

            const handleCancel = () => {
                onConfirmCallback(false);
                cleanup();
            };

            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
        }

        // Main App Logic
        class VoiceRecorderApp {
            constructor() {
                this.mediaRecorder = null;
                this.audioChunks = [];
                this.audioBlob = null; // Stores the currently recorded or uploaded audio blob
                this.startTime = null;
                this.timerInterval = null;
                this.isRecording = false;
                this.isPaused = false;
                this.recognition = null; // For Web Speech API live transcription
                this.aiService = new GeminiService();
                this.dbService = new DatabaseService();


                this.currentRecordingId = null; // To link transcript/summary to the recording
                this.currentTranscriptId = null; // To link summary to the transcript

                this.initializeElements();
                this.initializeEventListeners();
                this.initializeSpeechRecognition();
                this.initializeTheme();
                this.updateUI(); // Set initial UI state
                this.checkGenerateSummaryButton(); // Check on load
            }

            initializeElements() {
                // Recording controls
                this.startBtn = document.getElementById('startBtn');
                this.pauseBtn = document.getElementById('pauseBtn');
                this.stopBtn = document.getElementById('stopBtn');
                this.timer = document.getElementById('timer');
                this.recordingStatus = document.getElementById('recordingStatus');
                this.waveAnimation = document.getElementById('waveAnimation');
                this.audioPreview = document.getElementById('audioPreview');
                this.audioPlayer = document.getElementById('audioPlayer');

                // File upload
                this.dropZone = document.getElementById('dropZone');
                this.fileInput = document.getElementById('fileInput');
                this.uploadedAudioPreview = document.getElementById('uploadedAudioPreview');
                this.uploadedAudioPlayer = document.getElementById('uploadedAudioPlayer');

                // Transcript
                this.transcriptArea = document.getElementById('transcriptArea');
                this.transcribeBtn = document.getElementById('transcribeBtn');
                this.clearTranscriptBtn = document.getElementById('clearTranscriptBtn');
                this.copyTranscriptBtn = document.getElementById('copyTranscriptBtn');
                this.downloadTranscriptBtn = document.getElementById('downloadTranscriptBtn');

                // Summary
                this.summaryContent = document.getElementById('summaryContent');
                this.generateSummaryBtn = document.getElementById('generateSummaryBtn');
                this.copySummaryBtn = document.getElementById('copySummaryBtn');
                this.downloadSummaryBtn = document.getElementById('downloadSummaryBtn');

                // Theme
                this.themeToggle = document.getElementById('themeToggle');

                // History
                this.loadHistoryBtn = document.getElementById('loadHistoryBtn');
                this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
                this.recordingHistory = document.getElementById('recordingHistory');

                // All Recordings (Renamed from "Videos" to be more accurate)
                this.loadAllRecordingsBtn = document.getElementById('loadAllRecordingsBtn');
                this.clearAllRecordingsBtn = document.getElementById('clearAllRecordingsBtn');
                this.allRecordingsContainer = document.getElementById('allRecordingsContainer');

                // Toast Container
                this.toastContainer = document.getElementById('toastContainer');
            }

            initializeEventListeners() {
                // Recording controls
                this.startBtn.addEventListener('click', () => this.startRecording());
                this.pauseBtn.addEventListener('click', () => this.pauseRecording());
                this.stopBtn.addEventListener('click', () => this.stopRecording());

                // File upload
                this.dropZone.addEventListener('click', () => this.fileInput.click());
                this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
                this.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
                this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));
                this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

                // Transcript actions
                this.transcribeBtn.addEventListener('click', () => this.transcribeAudio());
                this.clearTranscriptBtn.addEventListener('click', () => this.clearTranscript());
                this.copyTranscriptBtn.addEventListener('click', () => this.copyTranscript());
                this.downloadTranscriptBtn.addEventListener('click', () => this.downloadTranscript());
                // Listen for changes in transcript area to enable/disable summary button
                this.transcriptArea.addEventListener('input', () => this.checkGenerateSummaryButton());


                // Summary actions
                this.generateSummaryBtn.addEventListener('click', () => this.generateSummary());
                this.copySummaryBtn.addEventListener('click', () => this.copySummary());
                this.downloadSummaryBtn.addEventListener('click', () => this.downloadSummary());

                // Theme toggle
                this.themeToggle.addEventListener('click', () => this.toggleTheme());

                // History actions
                this.loadHistoryBtn.addEventListener('click', () => this.loadRecordingHistory());
                this.clearHistoryBtn.addEventListener('click', () => this.clearRecordingHistory()); // This now also clears DB

                // All Recordings actions
                this.loadAllRecordingsBtn.addEventListener('click', () => this.loadAllRecordings());
                this.clearAllRecordingsBtn.addEventListener('click', () => this.clearAllRecordings()); // This only clears display
            }

            initializeSpeechRecognition() {
                if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                    this.recognition = new SpeechRecognition();
                    this.recognition.continuous = true;
                    this.recognition.interimResults = true; // Get interim results for live display
                    this.recognition.lang = 'en-US';

                    let finalTranscriptGlobal = ''; // Keep track of final transcript across sessions

                    this.recognition.onstart = () => {
                        console.log('Speech recognition started.');
                        finalTranscriptGlobal = ''; // Clear for new recognition session
                    };

                    this.recognition.onresult = (event) => {
                        let interimTranscript = '';
                        for (let i = event.resultIndex; i < event.results.length; i++) {
                            const transcriptSegment = event.results[i][0].transcript;
                            if (event.results[i].isFinal) {
                                finalTranscriptGlobal += transcriptSegment + ' ';
                            } else {
                                interimTranscript += transcriptSegment;
                            }
                        }
                        // Update transcript area with both final and interim results
                        this.transcriptArea.value = finalTranscriptGlobal + interimTranscript;
                        this.transcriptArea.scrollTop = this.transcriptArea.scrollHeight; // Scroll to bottom
                        this.checkGenerateSummaryButton();
                    };

                    this.recognition.onerror = (event) => {
                        console.error('Speech recognition error:', event.error);
                        this.recordingStatus.textContent = `Recognition Error: ${event.error}`;
                        this.showToast(`Speech recognition error: ${event.error}`, 'error');
                        // Attempt to restart recognition if it's not due to user stopping
                        if (this.isRecording && event.error !== 'aborted') {
                            console.log('Attempting to restart speech recognition due to error...');
                            setTimeout(() => { // Small delay before restarting
                                if (this.isRecording && !this.isPaused) { // Check state again
                                    this.recognition.start();
                                }
                            }, 500);
                        }
                    };

                    this.recognition.onend = () => {
                        console.log('Speech recognition ended.');
                        // Only restart if still recording and not manually stopped
                        if (this.isRecording && !this.isPaused) {
                            console.log('Speech recognition restarting due to end event...');
                            this.recognition.start();
                        }
                    };
                } else {
                    this.showToast('Web Speech API is not supported in this browser. Real-time transcription will not be available.', 'warning');
                    console.warn('Web Speech API not supported.');
                }
            }

            initializeTheme() {
                const savedTheme = localStorage.getItem('theme') || 'light';
                this.applyTheme(savedTheme);
            }

            async startRecording() {
                if (this.isRecording) return; // Prevent multiple starts

                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                    this.mediaRecorder = new MediaRecorder(stream);
                    this.audioChunks = [];
                    this.audioBlob = null; // Clear previous blob
                    this.transcriptArea.value = ''; // Clear previous transcript
                    this.summaryContent.textContent = 'No summary generated yet. Transcribe some audio first, then click "Generate AI Summary".';

                    this.mediaRecorder.addEventListener('dataavailable', (event) => {
                        if (event.data.size > 0) {
                            this.audioChunks.push(event.data);
                        }
                    });

                    this.mediaRecorder.addEventListener('stop', async () => {
                        const mimeType = this.mediaRecorder.mimeType.split(';')[0]; // Clean mime type
                        this.audioBlob = new Blob(this.audioChunks, { type: mimeType });
                        this.displayAudioPreview(this.audioBlob, this.audioPlayer, this.audioPreview);

                        // Stop all tracks to release the microphone immediately after mediaRecorder stops
                        stream.getTracks().forEach(track => track.stop());

                        // Save recording to database after it's fully stopped and blob is ready
                        await this.saveRecordingToDatabase(this.audioBlob);
                        this.transcribeBtn.disabled = false; // Enable transcribe button
                    });

                    this.mediaRecorder.start();
                    this.isRecording = true;
                    this.isPaused = false;
                    this.startTime = Date.now();
                    this.currentRecordingId = null; // Reset for new recording
                    this.currentTranscriptId = null; // Reset for new recording

                    // Start real-time transcription if available
                    if (this.recognition) {
                        this.recognition.start();
                    }

                    this.updateUI();
                    this.startTimer();
                    this.showToast('Recording started', 'success');
                } catch (error) {
                    console.error('Error starting recording:', error);
                    this.showToast('Error accessing microphone: ' + error.message, 'error');
                    this.updateUI(); // Ensure UI is reset on error
                }
            }

            pauseRecording() {
                if (this.mediaRecorder && this.isRecording) {
                    if (!this.isPaused) {
                        this.mediaRecorder.pause();
                        this.isPaused = true;
                        if (this.recognition) {
                            this.recognition.stop(); // Stop recognition when paused
                        }
                        this.showToast('Recording paused', 'warning');
                    } else {
                        this.mediaRecorder.resume();
                        this.isPaused = false;
                        if (this.recognition) {
                            this.recognition.start(); // Resume recognition
                        }
                        this.showToast('Recording resumed', 'success');
                    }
                    this.updateUI();
                }
            }

            stopRecording() {
                if (this.mediaRecorder && this.isRecording) {
                    this.mediaRecorder.stop(); // This triggers the 'stop' event listener
                    this.isRecording = false;
                    this.isPaused = false;

                    if (this.recognition) {
                        this.recognition.stop(); // Explicitly stop recognition
                    }

                    this.stopTimer();
                    this.updateUI();
                    this.showToast('Recording stopped', 'success');
                }
            }

            updateUI() {
                if (this.isRecording && !this.isPaused) {
                    this.startBtn.disabled = true;
                    this.pauseBtn.disabled = false;
                    this.stopBtn.disabled = false;
                    this.recordingStatus.textContent = 'Recording...';
                    this.recordingStatus.className = 'recording-status status-recording';
                    this.waveAnimation.classList.remove('hidden');
                    this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
                } else if (this.isRecording && this.isPaused) {
                    this.startBtn.disabled = true;
                    this.pauseBtn.disabled = false;
                    this.stopBtn.disabled = false;
                    this.recordingStatus.textContent = 'Paused';
                    this.recordingStatus.className = 'recording-status status-paused';
                    this.waveAnimation.classList.add('hidden');
                    this.pauseBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
                } else {
                    this.startBtn.disabled = false;
                    this.pauseBtn.disabled = true;
                    this.stopBtn.disabled = true;
                    this.recordingStatus.textContent = 'Ready to record';
                    this.recordingStatus.className = 'recording-status status-stopped';
                    this.waveAnimation.classList.add('hidden');
                    this.pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
                }
                // Enable/disable transcribe button based on whether an audio blob exists
                this.transcribeBtn.disabled = !this.audioBlob;
                this.checkGenerateSummaryButton(); // Re-check summary button state
            }

            startTimer() {
                this.timerInterval = setInterval(() => {
                    if (this.startTime && !this.isPaused) {
                        const elapsed = Date.now() - this.startTime;
                        const minutes = Math.floor(elapsed / 60000);
                        const seconds = Math.floor((elapsed % 60000) / 1000);
                        this.timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    }
                }, 1000);
            }

            stopTimer() {
                if (this.timerInterval) {
                    clearInterval(this.timerInterval);
                    this.timerInterval = null;
                }
                // Reset timer to 00:00 after recording stops
                this.timer.textContent = '00:00';
            }

            getRecordingDuration() {
                if (this.startTime && !this.isRecording) { // Only calculate final duration when stopped
                    return Math.floor((Date.now() - this.startTime) / 1000);
                }
                return 0; // Return 0 if still recording or not started
            }

            /**
             * Displays an audio preview in the specified player.
             * @param {Blob} blob - The audio blob to display.
             * @param {HTMLAudioElement} playerElement - The audio element to use.
             * @param {HTMLElement} previewContainer - The container element to show/hide.
             */
            displayAudioPreview(blob, playerElement, previewContainer) {
                // Revoke previous Object URL to prevent memory leaks
                if (playerElement.src && playerElement.src.startsWith('blob:')) {
                    URL.revokeObjectURL(playerElement.src);
                }
                const url = URL.createObjectURL(blob);
                playerElement.src = url;
                previewContainer.classList.remove('hidden');
            }

            handleDragOver(e) {
                e.preventDefault();
                this.dropZone.classList.add('dragover');
            }

            handleDragLeave(e) {
                e.preventDefault();
                this.dropZone.classList.remove('dragover');
            }

            handleDrop(e) {
                e.preventDefault();
                this.dropZone.classList.remove('dragover');
                const files = e.dataTransfer.files;
                this.processFiles(files);
            }

            handleFileSelect(e) {
                const files = e.target.files;
                this.processFiles(files);
            }

            processFiles(files) {
                if (files.length > 0) {
                    const file = files[0];

                    // Validate file type
                    const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/webm', 'audio/mpeg'];
                    if (!allowedTypes.includes(file.type)) {
                        this.showToast('Please select a valid audio file (MP3, WAV, M4A, WEBM)', 'error');
                        return;
                    }

                    // Validate file size (100MB limit)
                    if (file.size > 100 * 1024 * 1024) {
                        this.showToast('File size must be less than 100MB', 'error');
                        return;
                    }

                    this.audioBlob = file; // Set the audioBlob to the uploaded file
                    this.displayAudioPreview(this.audioBlob, this.uploadedAudioPlayer, this.uploadedAudioPreview);
                    this.transcribeBtn.disabled = false; // Enable transcribe button for uploaded file
                    this.transcriptArea.value = ''; // Clear old transcript when new file is loaded
                    this.summaryContent.textContent = 'No summary generated yet. Transcribe some audio first, then click "Generate AI Summary".';

                    // Clear recorded audio preview if an uploaded file is loaded
                    this.audioPreview.classList.add('hidden');
                    if (this.audioPlayer.src && this.audioPlayer.src.startsWith('blob:')) {
                        URL.revokeObjectURL(this.audioPlayer.src);
                    }
                    this.audioPlayer.src = '';

                    // Also reset current recording IDs as this is a new source
                    this.currentRecordingId = null;
                    this.currentTranscriptId = null;

                    this.showToast('Audio file uploaded successfully', 'success');
                }
            }

            async transcribeAudio() {
                if (!this.audioBlob) {
                    this.showToast('No audio to transcribe. Record or upload an audio file first.', 'error');
                    return;
                }

                try {
                    this.transcribeBtn.disabled = true;
                    this.transcribeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Transcribing...';
                    this.transcriptArea.value = 'Transcribing audio... Please wait.'; // Provide immediate feedback

                    // Simulate saving the uploaded audio as a "recording" for history purposes
                    // If it's an uploaded file and not already saved, save it now.
                    if (!this.currentRecordingId) {
                        const uploadedRecordingData = {
                            title: `Uploaded Audio ${new Date().toLocaleString()}`,
                            filename: this.audioBlob.name || `uploaded-audio-${Date.now()}.${this.audioBlob.type.split('/')[1] || 'webm'}`,
                            mimeType: this.audioBlob.type,
                            duration: 0, // Duration will be unknown for uploaded unless analyzed
                            fileSize: this.audioBlob.size
                        };
                        const savedRec = await this.dbService.saveRecording(uploadedRecordingData, this.audioBlob);
                        this.currentRecordingId = savedRec.id;
                    }

                    const transcript = await this.aiService.transcribeAudio(this.audioBlob);

                    if (transcript) {
                        this.transcriptArea.value = transcript;
                        this.checkGenerateSummaryButton();
                        this.showToast('Transcription completed', 'success');

                        // Save transcript to database, linked to currentRecordingId
                        await this.saveTranscriptToDatabase(transcript);
                    } else {
                        this.transcriptArea.value = 'No transcript generated. The AI service might be unavailable or returned an empty response.';
                        this.showToast('No transcript generated', 'warning');
                    }
                } catch (error) {
                    console.error('Transcription error:', error);
                    this.transcriptArea.value = 'Transcription failed. Please check your API key or try again later.';
                    this.showToast('Transcription failed: ' + error.message, 'error');
                } finally {
                    this.transcribeBtn.disabled = false;
                    this.transcribeBtn.innerHTML = '<i class="fas fa-microphone-alt"></i> Transcribe Audio';
                }
            }

            clearTranscript() {
                this.transcriptArea.value = '';
                this.summaryContent.textContent = 'No summary generated yet. Transcribe some audio first, then click "Generate AI Summary".';
                this.checkGenerateSummaryButton();
                this.showToast('Transcript and Summary cleared from display', 'info');
                // Do not clear currentRecordingId or currentTranscriptId here,
                // as they might still refer to a saved recording/transcript in DB.
            }

            copyTranscript() {
                if (this.transcriptArea.value.trim()) {
                    navigator.clipboard.writeText(this.transcriptArea.value).then(() => {
                        this.showToast('Transcript copied to clipboard', 'success');
                    }).catch(err => {
                        console.error('Failed to copy transcript:', err);
                        this.showToast('Failed to copy transcript', 'error');
                    });
                } else {
                    this.showToast('No transcript to copy', 'warning');
                }
            }

            downloadTranscript() {
                if (this.transcriptArea.value.trim()) {
                    const blob = new Blob([this.transcriptArea.value], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `transcript-${new Date().toISOString().slice(0, 10)}.txt`;
                    document.body.appendChild(a); // Append to body to make it clickable in all browsers
                    a.click();
                    document.body.removeChild(a); // Clean up the element
                    URL.revokeObjectURL(url); // Release the object URL
                    this.showToast('Transcript downloaded', 'success');
                } else {
                    this.showToast('No transcript to download', 'warning');
                }
            }

            async generateSummary() {
                const text = this.transcriptArea.value.trim();
                if (!text) {
                    this.showToast('No text to summarize. Transcribe some audio first.', 'error');
                    return;
                }

                try {
                    this.generateSummaryBtn.disabled = true;
                    this.generateSummaryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
                    this.summaryContent.innerHTML = '<div class="loading"><div class="spinner"></div>Generating AI summary...</div>';

                    const summary = await this.aiService.generateSummary(text);

                    if (summary) {
                        this.summaryContent.textContent = summary;
                        this.showToast('Summary generated successfully', 'success');

                        // Save summary to database, linked to currentTranscriptId
                        await this.saveSummaryToDatabase(summary);
                    } else {
                        this.summaryContent.textContent = 'Failed to generate summary. The AI service might be unavailable or returned an empty response.';
                        this.showToast('Summary generation failed', 'error');
                    }
                } catch (error) {
                    console.error('Summary generation error:', error);
                    this.summaryContent.textContent = 'Error generating summary: ' + error.message;
                    this.showToast('Summary generation failed: ' + error.message, 'error');
                } finally {
                    this.generateSummaryBtn.disabled = false;
                    this.generateSummaryBtn.innerHTML = '<i class="fas fa-brain"></i> Generate AI Summary';
                }
            }

            copySummary() {
                const summaryText = this.summaryContent.textContent;
                if (summaryText && summaryText !== 'No summary generated yet. Transcribe some audio first, then click "Generate AI Summary".' && !summaryText.includes('Generating AI summary...')) {
                    navigator.clipboard.writeText(summaryText).then(() => {
                        this.showToast('Summary copied to clipboard', 'success');
                    }).catch(err => {
                        console.error('Failed to copy summary:', err);
                        this.showToast('Failed to copy summary', 'error');
                    });
                } else {
                    this.showToast('No summary to copy', 'warning');
                }
            }

            downloadSummary() {
                const summaryText = this.summaryContent.textContent;
                if (summaryText && summaryText !== 'No summary generated yet. Transcribe some audio first, then click "Generate AI Summary".' && !summaryText.includes('Generating AI summary...')) {
                    const blob = new Blob([summaryText], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `summary-${new Date().toISOString().slice(0, 10)}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    this.showToast('Summary downloaded', 'success');
                } else {
                    this.showToast('No summary to download', 'warning');
                }
            }

            checkGenerateSummaryButton() {
                this.generateSummaryBtn.disabled = !this.transcriptArea.value.trim();
            }

            toggleTheme() {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                this.applyTheme(newTheme);
            }

            applyTheme(theme) {
                document.documentElement.setAttribute('data-theme', theme);
                localStorage.setItem('theme', theme);

                const icon = this.themeToggle.querySelector('i');
                if (theme === 'dark') {
                    icon.className = 'fas fa-sun';
                } else {
                    icon.className = 'fas fa-moon';
                }
            }

            showToast(message, type = 'success') {
                // Check if toast container exists, if not, create it
                if (!this.toastContainer) {
                    this.toastContainer = document.createElement('div');
                    this.toastContainer.id = 'toastContainer';
                    this.toastContainer.className = 'toast-container';
                    document.body.appendChild(this.toastContainer);
                }

                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.textContent = message;

                this.toastContainer.appendChild(toast);

                // Use requestAnimationFrame for smoother animation
                requestAnimationFrame(() => {
                    toast.classList.add('show');
                });

                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => {
                        if (toast.parentNode) { // Check if still in DOM before removing
                            toast.parentNode.removeChild(toast);
                        }
                    }, 300); // Allow time for fade-out animation
                }, 3000);
            }

            async saveRecordingToDatabase(audioBlob) {
                try {
                    const duration = this.getRecordingDuration(); // Get duration after stop
                    const recordingData = {
                        title: `Recording ${new Date().toLocaleString()}`,
                        filename: `recording-${Date.now()}.webm`, // Consistent filename
                        mimeType: audioBlob.type,
                        duration: duration,
                        fileSize: audioBlob.size
                    };

                    const recording = await this.dbService.saveRecording(recordingData, audioBlob); // Pass the audioBlob
                    this.currentRecordingId = recording.id;
                    this.showToast('Recording saved to history.', 'info');
                } catch (error) {
                    console.error('Failed to save recording:', error);
                    this.showToast('Failed to save recording to history: ' + error.message, 'error');
                }
            }

            async saveTranscriptToDatabase(transcript) {
                try {
                    // Ensure there's a recording ID to link to
                    if (!this.currentRecordingId) {
                        // This scenario happens if transcript is generated from an uploaded audio
                        // that wasn't previously saved or if a direct transcription without recording
                        const tempRecordingData = {
                            title: `Transcript Only ${new Date().toLocaleString()}`,
                            filename: `transcript-only-${Date.now()}.txt`,
                            mimeType: 'text/plain',
                            duration: 0,
                            fileSize: transcript.length // Approximation
                        };
                        const tempRecording = await this.dbService.saveRecording(tempRecordingData, null); // No audioBlob if only transcript
                        this.currentRecordingId = tempRecording.id;
                    }

                    const transcriptData = {
                        recordingId: this.currentRecordingId,
                        content: transcript,
                        language: 'en',
                        confidence: 95, // Placeholder
                        processingTime: 1000 // Placeholder
                    };

                    const savedTranscript = await this.dbService.saveTranscript(transcriptData);
                    this.currentTranscriptId = savedTranscript.id;
                    this.showToast('Transcript saved to history.', 'info');
                } catch (error) {
                    console.error('Failed to save transcript:', error);
                    this.showToast('Failed to save transcript to history: ' + error.message, 'error');
                }
            }

            async saveSummaryToDatabase(summary) {
                try {
                    if (this.currentTranscriptId) {
                        const summaryData = {
                            transcriptId: this.currentTranscriptId,
                            content: summary,
                            model: 'gemini-1.5-flash', // Updated model name
                            wordCount: summary.split(/\s+/).filter(word => word.length > 0).length, // More accurate word count
                            compressionRatio: this.transcriptArea.value.length > 0 ?
                                Math.round((summary.length / this.transcriptArea.value.length) * 100) : 0
                        };

                        await this.dbService.saveSummary(summaryData);
                        this.showToast('Summary saved to history.', 'info');
                    } else {
                        console.warn('Cannot save summary: No associated transcript ID.');
                        this.showToast('Summary could not be saved to history (no transcript found).', 'warning');
                    }
                } catch (error) {
                    console.error('Failed to save summary:', error);
                    this.showToast('Failed to save summary to history: ' + error.message, 'error');
                }
            }

            async loadRecordingHistory() {
                try {
                    this.loadHistoryBtn.disabled = true;
                    this.loadHistoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                    this.recordingHistory.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">Loading history...</p>';


                    const recordings = await this.dbService.getUserRecordings();
                    await this.displayRecordingHistory(recordings);
                    this.showToast('Recording history loaded.', 'success');
                } catch (error) {
                    console.error('Failed to load recording history:', error);
                    this.recordingHistory.innerHTML = '<p class="error-message">Failed to load recording history. Please try again.</p>';
                    this.showToast('Failed to load history: ' + error.message, 'error');
                } finally {
                    this.loadHistoryBtn.disabled = false;
                    this.loadHistoryBtn.innerHTML = '<i class="fas fa-refresh"></i> Load History';
                }
            }

            async displayRecordingHistory(recordings) {
                if (!Array.isArray(recordings) || recordings.length === 0) { // Added Array.isArray check
                    this.recordingHistory.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No recordings found. Start recording to build your history.</p>';
                    return;
                }

                let historyHtml = '';
                // Create a copy of the array and sort it
                const sortedRecordings = [...recordings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                for (const recording of sortedRecordings) {
                    try {
                        const transcript = await this.dbService.getTranscriptByRecording(recording.id);
                        const summary = transcript ? await this.dbService.getSummaryByTranscript(transcript.id) : null;

                        const date = new Date(recording.createdAt).toLocaleDateString();
                        const time = new Date(recording.createdAt).toLocaleTimeString();
                        const duration = this.formatDuration(recording.duration);
                        const fileSizeKB = (recording.fileSize / 1024).toFixed(1);

                        historyHtml += `
                            <div class="history-item">
                                <div class="history-header">
                                    <div class="history-title">${recording.title || 'Untitled Recording'}</div>
                                    <div class="history-date">${date} ${time}</div>
                                </div>
                                <div class="history-meta">
                                    <span>Duration: ${duration}</span>
                                    <span>Size: ${fileSizeKB} KB</span>
                                    <span>Format: ${recording.mimeType || 'N/A'}</span>
                                </div>
                                <div class="history-content">
                                    ${transcript ? `
                                        <div class="history-transcript">
                                            <strong>Transcript:</strong><br>
                                            <pre>${transcript.content}</pre>
                                        </div>
                                    ` : '<p class="no-data-msg">No transcript available.</p>'}
                                    ${summary ? `
                                        <div class="history-summary">
                                            <strong>AI Summary:</strong><br>
                                            <pre>${summary.content}</pre>
                                        </div>
                                    ` : '<p class="no-data-msg">No summary available.</p>'}
                                </div>
                                <div class="history-actions">
                                    <button class="btn btn-sm btn-danger" onclick="app.requestDeleteHistoryItem(${recording.id}, ${transcript ? transcript.id : 'null'}, ${summary ? summary.id : 'null'})">
                                        <i class="fas fa-trash"></i> Delete Entry
                                    </button>
                                </div>
                            </div>
                        `;
                    } catch (error) {
                        console.error('Error loading data for history item:', recording.id, error);
                        historyHtml += `
                            <div class="history-item error">
                                <p>Error loading details for recording ID: ${recording.id}</p>
                            </div>
                        `;
                    }
                }

                this.recordingHistory.innerHTML = historyHtml;
            }

            requestDeleteHistoryItem(recordingId, transcriptId, summaryId) {
                showCustomConfirm(
                    'Delete History Entry?',
                    'Are you sure you want to delete this specific history entry? This will permanently remove the recording, transcript, and summary from the database.',
                    (result) => {
                        if (result) {
                            this.deleteHistoryItem(recordingId, transcriptId, summaryId);
                        } else {
                            this.showToast('Deletion cancelled.', 'info');
                        }
                    }
                );
            }

            async deleteHistoryItem(recordingId, transcriptId, summaryId) {
                try {
                    await this.dbService.deleteRecording(recordingId);
                    if (transcriptId) {
                        await this.dbService.deleteTranscript(transcriptId);
                    }
                    if (summaryId) {
                        await this.dbService.deleteSummary(summaryId);
                    }
                    this.showToast('History entry deleted successfully.', 'success');
                    await this.loadRecordingHistory(); // Reload history to update display
                    await this.loadAllRecordings(); // Also update the "All Recordings" view
                } catch (error) {
                    console.error('Failed to delete history item:', error);
                    this.showToast('Failed to delete history entry: ' + error.message, 'error');
                }
            }


            formatDuration(seconds) {
                if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '00:00';
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }

            async clearRecordingHistory() {
                showCustomConfirm(
                    'Clear ALL Data?',
                    'Are you sure you want to clear ALL recording history, transcripts, and summaries from the database? This action cannot be undone.',
                    async (result) => {
                        if (result) {
                            try {
                                this.clearHistoryBtn.disabled = true;
                                this.clearHistoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clearing...';

                                await this.dbService.clearAllData(); // Clear all data from IndexedDB
                                this.recordingHistory.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No recordings found. Start recording to build your history.</p>';
                                this.showToast('All recording history, transcripts, and summaries cleared.', 'success');
                                await this.loadAllRecordings(); // Also clear and reload the "All Recordings" view
                            } catch (error) {
                                console.error('Failed to clear all recording history:', error);
                                this.showToast('Failed to clear all history: ' + error.message, 'error');
                            } finally {
                                this.clearHistoryBtn.disabled = false;
                                this.clearHistoryBtn.innerHTML = '<i class="fas fa-bomb"></i> Clear All Data';
                            }
                        } else {
                            this.showToast('Clear all data cancelled.', 'info');
                        }
                    }
                );
            }

            async loadAllRecordings() {
                try {
                    this.loadAllRecordingsBtn.disabled = true;
                    this.loadAllRecordingsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                    this.allRecordingsContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">Loading recordings...</p>';

                    const recordings = await this.dbService.getUserRecordings();
                    this.displayAllRecordings(recordings);
                    this.showToast('All recordings loaded.', 'success');
                } catch (error) {
                    console.error('Failed to load all recordings:', error);
                    this.allRecordingsContainer.innerHTML = '<p class="error-message">Failed to load recordings. Please try again.</p>';
                    this.showToast('Failed to load recordings: ' + error.message, 'error');
                } finally {
                    this.loadAllRecordingsBtn.disabled = false;
                    this.loadAllRecordingsBtn.innerHTML = '<i class="fas fa-refresh"></i> Load All Audios';
                }
            }

            async displayAllRecordings(recordings) {
                if (!Array.isArray(recordings) || recordings.length === 0) { // Added Array.isArray check
                    this.allRecordingsContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No recordings found. Start recording to see your audios here.</p>';
                    return;
                }

                // Create a copy of the array and sort it
                const sortedRecordings = [...recordings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                const recordingsHtml = sortedRecordings.map(recording => {
                    const duration = this.formatDuration(recording.duration);
                    const date = new Date(recording.createdAt).toLocaleDateString();
                    const time = new Date(recording.createdAt).toLocaleTimeString();

                    return `
                        <div class="video-item">
                            <div class="video-thumbnail">
                                <i class="fas fa-microphone"></i> <!-- Keeping microphone icon for audio -->
                            </div>
                            <div class="video-info">
                                <div class="video-title">${recording.title || 'Untitled Audio'}</div>
                                <div class="video-duration">Duration: ${duration}</div>
                                <div class="video-date">${date} at ${time}</div>
                            </div>
                            <div class="video-actions">
                                <button class="btn btn-sm" onclick="app.playRecording(${recording.id})">
                                    <i class="fas fa-play"></i> Play
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="app.downloadRecording(${recording.id})">
                                    <i class="fas fa-download"></i> Download
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="app.requestDeleteRecordingFromAllRecordings(${recording.id})">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');

                this.allRecordingsContainer.innerHTML = recordingsHtml;
            }

            requestDeleteRecordingFromAllRecordings(recordingId) {
                showCustomConfirm(
                    'Delete Recording?',
                    'Are you sure you want to delete this recording? This will also permanently remove its associated transcript and summary from the database.',
                    (result) => {
                        if (result) {
                            this.deleteRecordingFromAllRecordings(recordingId);
                        } else {
                            this.showToast('Deletion cancelled.', 'info');
                        }
                    }
                );
            }

            async deleteRecordingFromAllRecordings(recordingId) {
                try {
                    // Find associated transcript and summary IDs first
                    const transcript = await this.dbService.getTranscriptByRecording(recordingId);
                    let summaryId = null;
                    if (transcript) {
                        const summary = await this.dbService.getSummaryByTranscript(transcript.id);
                        if (summary) {
                            summaryId = summary.id;
                        }
                    }

                    // Delete in correct order (summary then transcript then recording)
                    if (summaryId) {
                        await this.dbService.deleteSummary(summaryId);
                    }
                    if (transcript) {
                        await this.dbService.deleteTranscript(transcript.id);
                    }
                    await this.dbService.deleteRecording(recordingId);

                    this.showToast('Recording and associated data deleted successfully.', 'success');
                    await this.loadAllRecordings(); // Reload the list
                    await this.loadRecordingHistory(); // Also update history display
                } catch (error) {
                    console.error('Failed to delete recording:', error);
                    this.showToast('Failed to delete recording: ' + error.message, 'error');
                }
            }


            async clearAllRecordings() {
                this.showToast('This button only clears the display. Use "Clear All Data" in History to delete from database.', 'info');
                try {
                    this.clearAllRecordingsBtn.disabled = true;
                    this.clearAllRecordingsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clearing...';

                    this.allRecordingsContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">Click "Load All Audios" to view your recorded audios</p>';
                    this.showToast('All recordings cleared from display.', 'info');
                } catch (error) {
                    console.error('Failed to clear all recordings from display:', error);
                    this.showToast('Failed to clear recordings display: ' + error.message, 'error');
                } finally {
                    this.clearAllRecordingsBtn.disabled = false;
                    this.clearAllRecordingsBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Clear Display';
                }
            }

            async playRecording(recordingId) {
                try {
                    const recording = await this.dbService.getRecording(recordingId);
                    if (recording && recording.audioBlob) {
                        // Ensure only one audio player is active/visible for playback
                        this.audioPreview.classList.add('hidden'); // Hide recording preview
                        this.uploadedAudioPreview.classList.remove('hidden'); // Show uploaded player for history playback
                        this.displayAudioPreview(recording.audioBlob, this.uploadedAudioPlayer, this.uploadedAudioPreview);
                        this.uploadedAudioPlayer.play();
                        this.showToast(`Playing: ${recording.title || 'recording'}`, 'info');
                    } else {
                        this.showToast('Recording audio data not found or invalid.', 'error');
                    }
                } catch (error) {
                    console.error('Failed to play recording:', error);
                    this.showToast('Failed to play recording: ' + error.message, 'error');
                }
            }

            async downloadRecording(recordingId) {
                try {
                    const recording = await this.dbService.getRecording(recordingId);
                    if (recording && recording.audioBlob) {
                        const url = URL.createObjectURL(recording.audioBlob);
                        const a = document.createElement('a');
                        a.href = url;
                        // Use a descriptive filename, fallback to generated
                        a.download = recording.filename || `${recording.title || 'recording'}-${new Date(recording.createdAt).toISOString().slice(0, 10)}.${recording.mimeType.split('/')[1] || 'webm'}`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url); // Revoke the URL after download starts
                        this.showToast('Downloading recording...', 'success');
                    } else {
                        this.showToast('Recording data not found or invalid.', 'error');
                    }
                } catch (error) {
                    console.error('Failed to download recording:', error);
                    this.showToast('Failed to download recording: ' + error.message, 'error');
                }
            }
        }

        // Initialize the application when the DOM is loaded
        let app; // Global reference for onclick handlers in dynamically created HTML
        document.addEventListener('DOMContentLoaded', () => {
            app = new VoiceRecorderApp();
        });
    
