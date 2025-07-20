import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import './App.css';

function App() {
  const [resumeFile, setResumeFile] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [scores, setScores] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);

  // Load theme preference from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setDarkMode(savedTheme === 'dark');
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setResumeFile(file);
      setQuestions([]);
      setAnswers({});
      setScores([]);
      setFeedback([]);
      setError('');
      setCurrentStep(2);
    } else {
      setError('Please select a valid PDF file');
    }
  };

  const extractTextFromPDF = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const typedArray = new Uint8Array(reader.result);
        try {
          const pdfjsLib = await import('pdfjs-dist/build/pdf');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            const pageText = text.items.map(item => item.str).join(' ');
            fullText += `${pageText}\n`;
          }
          resolve(fullText);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleSubmit = async () => {
    if (!resumeFile) {
      setError('❗ Please upload a resume PDF');
      return;
    }

    setLoading(true);
    setError('');
    setQuestions([]);
    setCurrentStep(3);

    try {
      const text = await extractTextFromPDF(resumeFile);
      const response = await axios.post('http://localhost:5000/api/generate', {
        resumeText: text
      });
      const generatedQuestions = response.data.questions.split('\n').filter(q => q.trim());
      setQuestions(generatedQuestions);
      setCurrentStep(4);
    } catch (err) {
      console.error('❌ AxiosError:', err);
      setError('❌ Failed to generate questions. Please check the server or API key.');
      setCurrentStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (index, value) => {
    setAnswers({ ...answers, [index]: value });
  };

  const handleEvaluate = async () => {
    const payload = {
      questions,
      answers: Object.values(answers),
      resumeText: ''
    };

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/api/score', payload);
      setScores(response.data.scores || []);
      setFeedback(response.data.feedback || []);
      setCurrentStep(5);
    } catch (err) {
      console.error('❌ Evaluation Error:', err);
      setError('❌ Failed to evaluate answers.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    questions.forEach((q, i) => {
      doc.text(`Q${i + 1}: ${q}`, 10, 10 + i * 40);
      doc.text(`Ans: ${answers[i] || ''}`, 10, 18 + i * 40);
      doc.text(`Score: ${scores[i] !== undefined ? scores[i] : 'N/A'}`, 10, 26 + i * 40);
      doc.text(`Feedback: ${feedback[i] || 'N/A'}`, 10, 34 + i * 40);
    });
    doc.save('interview-feedback.pdf');
  };

  const getStepStatus = (step) => {
    if (step < currentStep) return 'completed';
    if (step === currentStep) return 'active';
    return 'pending';
  };

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>🤖 AI Interview Preparation Tool</h1>
          <button className="theme-toggle" onClick={toggleTheme}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="progress-steps">
        <div className={`step ${getStepStatus(1)}`}>
          <div className="step-number">1</div>
          <span>Upload Resume</span>
        </div>
        <div className={`step ${getStepStatus(2)}`}>
          <div className="step-number">2</div>
          <span>Generate Questions</span>
        </div>
        <div className={`step ${getStepStatus(3)}`}>
          <div className="step-number">3</div>
          <span>Answer Questions</span>
        </div>
        <div className={`step ${getStepStatus(4)}`}>
          <div className="step-number">4</div>
          <span>Get Feedback</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="main-content">
        {/* File Upload Section */}
        <div className="upload-section">
          <div className="upload-card">
            <div className="upload-icon">📄</div>
            <h2>Upload Your Resume</h2>
            <p>Upload a PDF file to generate personalized interview questions</p>
            
            <div className="file-input-wrapper">
              <input 
                type="file" 
                accept=".pdf" 
                onChange={handleFileChange}
                id="file-input"
                className="file-input"
              />
              <label htmlFor="file-input" className="file-input-label">
                {resumeFile ? `📎 ${resumeFile.name}` : '📁 Choose PDF File'}
              </label>
            </div>

            {resumeFile && (
              <button 
                className="generate-btn" 
                onClick={handleSubmit} 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    Generating Questions...
                  </>
                ) : (
                  '🚀 Generate Interview Questions'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-card">
            <div className="error-icon">⚠️</div>
            <p>{error}</p>
          </div>
        )}

        {/* Questions Section */}
        {questions.length > 0 && (
          <div className="questions-section">
            <div className="section-header">
              <h2>📝 Interview Questions</h2>
              <p>Answer each question thoughtfully. Your responses will be evaluated for quality and relevance.</p>
            </div>

            <div className="questions-grid">
              {questions.map((q, i) => (
                <div key={i} className="question-card">
                  <div className="question-header">
                    <span className="question-number">Q{i + 1}</span>
                    {scores[i] !== undefined && (
                      <span className={`score-badge ${scores[i] >= 7 ? 'high' : scores[i] >= 4 ? 'medium' : 'low'}`}>
                        🎯 {scores[i]}/10
                      </span>
                    )}
                  </div>
                  
                  <p className="question-text">{q}</p>
                  
                  <textarea
                    className="answer-input"
                    value={answers[i] || ''}
                    onChange={(e) => handleAnswerChange(i, e.target.value)}
                    placeholder="Type your answer here..."
                    rows="4"
                  />
                  
                  {feedback[i] && (
                    <div className="feedback-card">
                      <div className="feedback-header">
                        <span className="feedback-icon">💡</span>
                        <strong>AI Feedback</strong>
                      </div>
                      <p className="feedback-text">{feedback[i]}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="action-buttons">
              <button 
                className="evaluate-btn" 
                onClick={handleEvaluate}
                disabled={loading || Object.keys(answers).length === 0}
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    Evaluating...
                  </>
                ) : (
                  '📊 Get AI Evaluation'
                )}
              </button>
              
              {scores.length > 0 && (
                <button className="download-btn" onClick={handleDownloadPDF}>
                  📥 Download Report
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
