import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Upload,
  Database,
  MessageSquare,
  Code,
  Copy,
  Check,
  Moon,
  Sun,
  Loader2,
  AlertCircle,
  Menu,
  X,
  Settings,
  History,
  PlusCircle,
  Trash2,
  Download,
  ChevronRight,
  ChevronLeft,
  Edit3,
  CheckCircle,
  XCircle,
  Sparkles,
  Globe,
  Search,
  Play,
  Eye,
  EyeOff
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import api from './services/api';
import { cn, formatDate, copyToClipboard } from './lib/utils';
import './App.css';

function App() {
  // Initialize dark mode from localStorage or default to true
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [resultsPanelOpen, setResultsPanelOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [file, setFile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [currentResults, setCurrentResults] = useState(null);
  const [lastQuery, setLastQuery] = useState('');
  const [queryExecuted, setQueryExecuted] = useState(false);
  const [currentDbName, setCurrentDbName] = useState('');
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const settingsRef = useRef(null);

  // Apply dark mode class to html element and save to localStorage
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Check backend connection on load
  useEffect(() => {
    checkBackend();
    // Load sessions from localStorage
    const savedSessions = localStorage.getItem('chatSessions');
    if (savedSessions) {
      setSessions(JSON.parse(savedSessions));
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close settings when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkBackend = async () => {
    try {
      await api.healthCheck();
      setBackendStatus('connected');
    } catch {
      setBackendStatus('disconnected');
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && (selectedFile.name.endsWith('.db') || selectedFile.name.endsWith('.sqlite'))) {
      setFile(selectedFile);
    } else {
      alert('Please select a valid SQLite database file (.db or .sqlite)');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    try {
      const data = await api.uploadDatabase(file);
      setCurrentSessionId(data.session_id);
      setCurrentDbName(file.name);
      
      // Add system message
      setMessages([{
        id: Date.now(),
        role: 'system',
        content: `✅ Database "${file.name}" uploaded successfully. You can now ask questions about your data.`,
        timestamp: new Date()
      }]);
      
      setShowUploadModal(false);
      setFile(null);
      
      // Save session
      const newSession = {
        id: data.session_id,
        name: file.name,
        timestamp: new Date().toISOString(),
        lastMessage: 'New chat',
        messageCount: 0
      };
      const updatedSessions = [newSession, ...sessions];
      setSessions(updatedSessions);
      localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRunQuery = async () => {
    if (!input.trim() || loading || !currentSessionId) {
      if (!currentSessionId) {
        alert('Please upload a database first');
      }
      return;
    }

    setLoading(true);
    setQueryExecuted(false);

    try {
      const response = await api.sendQuery(currentSessionId, input);
      
      // Check the structure of the response
      let resultData;
      if (response.result) {
        resultData = response.result;
      } else {
        resultData = response;
      }
      
      // Create result object for this query
      const queryResult = {
        query: input,
        explanation: resultData.explanation || resultData.user_message || '',
        sql: resultData.sql || '',
        data: resultData.data || [],
        status: resultData.status || 'success',
        timestamp: new Date()
      };
      
      // Add user message to chat
      const userMessage = {
        id: Date.now(),
        role: 'user',
        content: input,
        timestamp: new Date()
      };
      
      // Add assistant message with results and Show Results button
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: resultData.user_message || 'Query executed successfully.',
        explanation: resultData.explanation || '',
        sql: resultData.sql || '',
        data: resultData.data || [],
        result: queryResult,
        status: resultData.status || 'success',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage, assistantMessage]);
      
      // Store the latest result for the results panel
      setCurrentResults(queryResult);
      setLastQuery(input);
      setQueryExecuted(true);

      // Update session last message and count
      const updatedSessions = sessions.map(s => 
        s.id === currentSessionId ? { 
          ...s, 
          lastMessage: input.substring(0, 30) + '...',
          messageCount: (s.messageCount || 0) + 2
        } : s
      );
      setSessions(updatedSessions);
      localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));

    } catch (error) {
      console.error('Query failed:', error);
      
      // Add error message to chat
      const errorMessage = {
        id: Date.now(),
        role: 'error',
        content: 'Error: ' + error.message,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      alert('Query failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShowResults = (result) => {
    setCurrentResults(result);
    setResultsPanelOpen(true);
  };

  const handleCopySQL = async (sql, index) => {
    const success = await copyToClipboard(sql);
    if (success) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId('');
    setCurrentDbName('');
    setMessages([]);
    setCurrentResults(null);
    setResultsPanelOpen(false);
    setQueryExecuted(false);
    setLastQuery('');
    setShowUploadModal(true);
  };

  const loadSession = (session) => {
    setCurrentSessionId(session.id);
    setCurrentDbName(session.name);
    setMessages([{
      id: Date.now(),
      role: 'system',
      content: `Loaded session: ${session.name}`,
      timestamp: new Date()
    }]);
    setSidebarOpen(false);
  };

  // Function to open delete confirmation modal for a specific chat
  const openDeleteModal = (session, e) => {
    e.stopPropagation();
    setSessionToDelete(session);
    setShowDeleteModal(true);
  };

  // Function to confirm and delete a specific chat
  const confirmDeleteChat = () => {
    if (sessionToDelete) {
      const updatedSessions = sessions.filter(s => s.id !== sessionToDelete.id);
      setSessions(updatedSessions);
      localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));
      
      if (currentSessionId === sessionToDelete.id) {
        setCurrentSessionId('');
        setCurrentDbName('');
        setMessages([]);
        setCurrentResults(null);
        setResultsPanelOpen(false);
        setQueryExecuted(false);
      }
      
      setShowDeleteModal(false);
      setSessionToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setSessionToDelete(null);
  };

  const handleClearAllSessions = () => {
    setSessions([]);
    localStorage.removeItem('chatSessions');
    setCurrentSessionId('');
    setCurrentDbName('');
    setMessages([]);
    setCurrentResults(null);
    setResultsPanelOpen(false);
    setQueryExecuted(false);
    setShowClearAllConfirm(false);
    setShowSettings(false);
  };

  const handleRenameSession = (session, e) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingName(session.name);
  };

  const saveRenameSession = (sessionId) => {
    const updatedSessions = sessions.map(s => 
      s.id === sessionId ? { ...s, name: editingName } : s
    );
    setSessions(updatedSessions);
    localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));
    setEditingSessionId(null);
    
    if (sessionId === currentSessionId) {
      setCurrentDbName(editingName);
    }
  };

  const exportSession = (session, e) => {
    e.stopPropagation();
    const sessionData = {
      ...session,
      exportDate: new Date().toISOString()
    };
    const dataStr = JSON.stringify(sessionData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `session-${session.name}-${Date.now()}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeResultsPanel = () => {
    setResultsPanelOpen(false);
  };

  // MessageContent component for displaying chat messages
  const MessageContent = ({ message, index }) => {
    if (message.role === 'system') {
      return (
        <div className="message system">
          <Database size={14} />
          <span>{message.content}</span>
        </div>
      );
    }

    if (message.role === 'error') {
      return (
        <div className="message error">
          <AlertCircle size={14} />
          <span>{message.content}</span>
        </div>
      );
    }

    if (message.role === 'user') {
      return (
        <div className="message user">
          <div className="message-content">
            <p>{message.content}</p>
            <div className="message-timestamp">{formatDate(message.timestamp)}</div>
          </div>
        </div>
      );
    }

    // Assistant message
    return (
      <div className="message assistant">
        <div className="message-content">
          <ReactMarkdown className="prose prose-invert">
            {message.content}
          </ReactMarkdown>
          
          {message.explanation && (
            <div className="explanation-block">
              <Sparkles size={14} />
              <span>{message.explanation}</span>
            </div>
          )}
          
          {message.sql && (
            <div className="sql-block">
              <div className="sql-header">
                <Code size={14} />
                <span>SQL</span>
                <button 
                  onClick={() => handleCopySQL(message.sql, index)}
                  className="copy-sql-btn"
                >
                  {copiedIndex === index ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <SyntaxHighlighter
                language="sql"
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  borderRadius: '0 0 12px 12px',
                  fontSize: '12px',
                  padding: '12px'
                }}
              >
                {message.sql}
              </SyntaxHighlighter>
            </div>
          )}

          {/* Show Results Button */}
          {message.result && (
            <button 
              className="show-results-from-message"
              onClick={() => handleShowResults(message.result)}
            >
              <Eye size={14} />
              Show Full Results
            </button>
          )}
        </div>
        <div className="message-timestamp">{formatDate(message.timestamp)}</div>
      </div>
    );
  };

  return (
    <div className={`app-container ${resultsPanelOpen ? 'results-active' : ''}`}>
      {/* Sidebar Toggle Button */}
      <button 
        className={`sidebar-toggle ${sidebarOpen ? 'open' : ''}`}
        onClick={toggleSidebar}
        title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      >
        {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      {/* Database Status Strip - Shows when sidebar is closed */}
      {currentDbName && (
        <div className="db-status-strip">
          <span className="db-indicator"></span>
          <span className="db-name-text">{currentDbName}</span>
        </div>
      )}

      {/* Theme/Settings Toggle */}
      <button 
        className="theme-toggle"
        onClick={toggleDarkMode}
        title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Left Sidebar - Chat History */}
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon">
              <Database size={24} />
            </div>
            <h2 className="logo-text">NL to <span>SQL</span></h2>
          </div>
          <button className="new-chat-btn" onClick={handleNewChat}>
            <PlusCircle size={18} />
            <span>New Chat</span>
          </button>
        </div>

        <div className="chat-history">
          <h3 className="history-title">
            <History size={16} />
            Recent Queries
          </h3>
          <div className="chat-list">
            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <History className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No chats yet</p>
                <p className="text-xs text-gray-600 mt-1">Start a new chat to begin</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`chat-item ${session.id === currentSessionId ? 'active' : ''}`}
                >
                  {editingSessionId === session.id ? (
                    <div className="flex items-center gap-1 p-2 w-full">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => saveRenameSession(session.id)}
                        className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingSessionId(null)}
                        className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="chat-item-icon" onClick={() => loadSession(session)}>
                        <Database size={14} />
                      </div>
                      <div className="chat-item-content" onClick={() => loadSession(session)}>
                        <div className="chat-item-title">{session.name}</div>
                        {session.lastMessage && (
                          <div className="chat-item-preview">{session.lastMessage}</div>
                        )}
                        <div className="chat-item-date">
                          {new Date(session.timestamp).toLocaleDateString()}
                          {session.messageCount > 0 && ` • ${session.messageCount} messages`}
                        </div>
                      </div>
                      <div className="chat-item-actions">
                        <button
                          onClick={(e) => handleRenameSession(session, e)}
                          className="p-1 hover:bg-gray-700 rounded"
                          title="Rename"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={(e) => exportSession(session, e)}
                          className="p-1 hover:bg-gray-700 rounded"
                          title="Export"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={(e) => openDeleteModal(session, e)}
                          className="p-1 hover:bg-red-500/10 rounded"
                          title="Delete"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`main-content ${sidebarOpen ? 'sidebar-visible' : 'sidebar-hidden'}`}>
        {/* Welcome Screen or Chat Messages */}
        {messages.length === 0 ? (
          <div className="welcome-container">
            <div className="welcome-content">
              <div className="welcome-logo">
                <Database size={64} />
              </div>
              <h1 className="welcome-title">NL to SQL</h1>
              <p className="welcome-subtitle">
                Ask questions in natural language and get SQL queries with results
              </p>
            </div>
          </div>
        ) : (
          /* Chat Messages Container */
          <div className="chat-messages-container" ref={chatContainerRef}>
            {messages.map((message, index) => (
              <MessageContent key={message.id} message={message} index={index} />
            ))}
            {loading && (
              <div className="loading-indicator">
                <Loader2 size={20} className="spinner" />
                <span>Processing query...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Chat Input Section - Always Visible */}
      <div className="bottom-chat-container">
        <div className="bottom-chat-wrapper">
          <div className="bottom-chat-card">
            <div className="bottom-input-container">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleRunQuery();
                  }
                }}
                placeholder={currentSessionId ? "Ask a question in natural language..." : "Upload a database first..."}
                disabled={!currentSessionId || loading}
                className="bottom-input"
              />
              <button 
                onClick={handleRunQuery}
                className="bottom-run-button"
                disabled={!input.trim() || loading || !currentSessionId}
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                <span>Run</span>
              </button>
            </div>
            
            {/* Upload Prompt - Only when no database */}
            {!currentSessionId && (
              <div className="upload-prompt">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="upload-prompt-button"
                >
                  <Upload size={16} />
                  Upload a database to start querying
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Panel - Shows when "Show Full Results" is clicked */}
      {resultsPanelOpen && currentResults && (
        <div className="results-panel">
          <div className="results-header">
            <h3>Query Results</h3>
            <button className="close-results" onClick={closeResultsPanel}>
              <X size={18} />
            </button>
          </div>

          <div className="results-content">
            {/* User Query Section */}
            {currentResults.query && (
              <div className="result-section">
                <div className="section-label">
                  <Search size={14} />
                  <span>Your Query</span>
                </div>
                <div className="query-text">
                  "{currentResults.query}"
                </div>
              </div>
            )}

            {/* Explanation Section */}
            {currentResults.explanation && (
              <div className="result-section">
                <div className="section-label">
                  <Sparkles size={14} />
                  <span>AI Explanation</span>
                </div>
                <div className="explanation-text">
                  <ReactMarkdown>
                    {currentResults.explanation}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* SQL Query Section */}
            {currentResults.sql && (
              <div className="result-section">
                <div className="section-label">
                  <Code size={14} />
                  <span>Generated SQL</span>
                  <button 
                    className="copy-sql-btn"
                    onClick={() => handleCopySQL(currentResults.sql, 'results')}
                  >
                    {copiedIndex === 'results' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <SyntaxHighlighter
                  language="sql"
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    borderRadius: '12px',
                    fontSize: '13px',
                    padding: '16px'
                  }}
                >
                  {currentResults.sql}
                </SyntaxHighlighter>
              </div>
            )}

            {/* Results Data Table */}
            {currentResults.data && currentResults.data.length > 0 ? (
              <div className="result-section">
                <div className="section-label">
                  <Database size={14} />
                  <span>Results ({currentResults.data.length} rows)</span>
                </div>
                <div className="data-table-container">
                  <table className="results-table">
                    <thead>
                      <tr>
                        {Object.keys(currentResults.data[0]).map((key) => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentResults.data.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {Object.values(row).map((value, colIndex) => (
                            <td key={colIndex}>
                              {value === null || value === undefined ? 'NULL' : String(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : currentResults.data && currentResults.data.length === 0 ? (
              <div className="result-section">
                <div className="section-label">
                  <Database size={14} />
                  <span>Results</span>
                </div>
                <div className="empty-results">
                  No results returned
                </div>
              </div>
            ) : null}
          </div>

          <div className="results-footer">
            <button className="export-btn">
              <Download size={14} />
              Export
            </button>
            <button className="share-btn">
              <Globe size={14} />
              Share
            </button>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Upload Database</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setFile(null);
                }}
                className="modal-close"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="modal-body">
              <div 
                className="upload-area"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".db,.sqlite"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="upload-icon" size={32} />
                <p className="upload-text">
                  {file ? file.name : "Click to select or drag and drop"}
                </p>
                <p className="upload-hint">
                  SQLite database files only (.db, .sqlite)
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setFile(null);
                }}
                className="export-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="share-btn"
              >
                {uploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Chat Confirmation Modal */}
      {showDeleteModal && sessionToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Delete Chat</h3>
              <button
                onClick={cancelDelete}
                className="modal-close"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-500/10 rounded-full">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-white mb-2">
                    Delete "{sessionToDelete.name}"?
                  </h4>
                  <p className="text-sm text-gray-400">
                    This will permanently delete this chat and all its messages. This action cannot be undone.
                  </p>
                  
                  {sessionToDelete.messageCount > 0 && (
                    <p className="text-sm text-gray-400 mt-2">
                      This chat contains {sessionToDelete.messageCount} messages.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={cancelDelete}
                className="export-btn"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteChat}
                className="share-btn"
                style={{ background: '#ef4444' }}
              >
                <Trash2 size={14} />
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearAllConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Clear All Chats</h3>
              <button
                onClick={() => setShowClearAllConfirm(false)}
                className="modal-close"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-500/10 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-white mb-2">
                    Delete all chats?
                  </h4>
                  <p className="text-sm text-gray-400">
                    Are you sure you want to delete all {sessions.length} chats? This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowClearAllConfirm(false)}
                className="export-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllSessions}
                className="share-btn"
                style={{ background: '#ef4444' }}
              >
                <Trash2 size={14} />
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Dropdown */}
      {showSettings && (
        <div className="settings-dropdown" ref={settingsRef}>
          <div className="settings-item" onClick={toggleDarkMode}>
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
          <div className="settings-item" onClick={() => setShowClearAllConfirm(true)}>
            <Trash2 size={14} className="text-red-400" />
            <span className="text-red-400">Clear All Chats</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;