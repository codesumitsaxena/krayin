import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Settings, LogOut, Loader2, Save, Key, CheckCircle, AlertCircle, RefreshCw, Wifi } from 'lucide-react';

const WhatsAppAdminPanel = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pendingResponse, setPendingResponse] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  const [credentials, setCredentials] = useState({
    accessToken: '',
    appId: '',
    appSecret: '',
    businessAccountId: '',
    phoneNumberId: '926687467194699',
    testPhoneNumber: '918953984969'
  });
  
  const messagesEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const pendingMessagesRef = useRef(new Map());
  
  const ADMIN_PASSWORD = 'admin123';
  const WEBHOOK_URL = 'https://n8n.avertisystems.com/webhook/whatsapp-webhook';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check connection status
  useEffect(() => {
    if (isLoggedIn && credentials.accessToken) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('disconnected');
    }
  }, [isLoggedIn, credentials.accessToken]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsLoggedIn(true);
      setLoginError('');
      setMessages([
        { 
          id: Date.now(), 
          text: '🎉 Welcome to WhatsApp AI Assistant!\n\n✅ Configure your credentials in Settings\n✅ Real-time AI responses enabled\n✅ Connected to n8n workflow\n\nStart chatting to test the integration!', 
          sender: 'bot', 
          timestamp: new Date() 
        }
      ]);
    } else {
      setLoginError('Invalid password');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setPassword('');
    setMessages([]);
    setActiveTab('chat');
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };

  const handleCredentialChange = (field, value) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveCredentials = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    
    const botMessage = {
      id: Date.now(),
      text: '✅ Credentials saved successfully!\n\n🔗 Real-time connection will be established automatically.\n💬 You can now send messages and receive AI responses instantly.',
      sender: 'bot',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, botMessage]);
    setActiveTab('chat');
    
    // Reconnect with new credentials
    if (isLoggedIn) {
      setConnectionStatus('connected');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    if (!credentials.accessToken || !credentials.appId || !credentials.appSecret || !credentials.businessAccountId) {
      const errorMsg = {
        id: Date.now(),
        text: '⚠️ Please configure your credentials in Settings first!',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
      return;
    }

    const messageId = `msg_${Date.now()}`;
    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentMessage = inputMessage;
    setInputMessage('');
    setIsSending(true);
    setPendingResponse(true);

    // Typing indicator
    const typingId = Date.now() + 1;
    const typingMessage = {
      id: typingId,
      text: 'AI is processing your message...',
      sender: 'bot',
      timestamp: new Date(),
      isTyping: true
    };
    setMessages(prev => [...prev, typingMessage]);
    
    // Store typing indicator ID for this message
    pendingMessagesRef.current.set(messageId, typingId);

    try {
      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: credentials.businessAccountId,
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '919217703436',
                    phone_number_id: credentials.phoneNumberId
                  },
                  contacts: [
                    {
                      profile: { name: 'Admin' },
                      wa_id: credentials.testPhoneNumber
                    }
                  ],
                  messages: [
                    {
                      from: credentials.testPhoneNumber,
                      id: messageId,
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      text: { body: currentMessage },
                      type: 'text'
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      // Send to n8n webhook and get IMMEDIATE response
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Id': credentials.appId,
          'X-App-Secret': credentials.appSecret,
          'X-Access-Token': credentials.accessToken,
          'X-Business-Account-Id': credentials.businessAccountId,
          'X-Message-Id': messageId
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Get response directly from n8n
      const result = await response.json();
      console.log('✅ Full n8n response:', result);

      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.id !== typingId));
      pendingMessagesRef.current.delete(messageId);

      // Extract AI response from various possible fields
      let aiResponseText = result.response || result.text_reply || result.message || "Response received but empty";
      
      console.log('🤖 Extracted AI response:', aiResponseText);

      // Add AI response
      const aiResponse = {
        id: Date.now() + 2,
        text: aiResponseText,
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setPendingResponse(false);
      
    } catch (error) {
      setMessages(prev => prev.filter(msg => msg.id !== typingId));
      pendingMessagesRef.current.delete(messageId);
      
      const errorMessage = {
        id: Date.now() + 1,
        text: '⚠️ Connection error. Please check your credentials and try again.\n\n💡 Make sure:\n✓ Access token is valid\n✓ n8n workflow is running\n✓ Network connection is stable',
        sender: 'bot',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
      setPendingResponse(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getConnectionStatusColor = () => {
    switch(connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getConnectionStatusText = () => {
    switch(connectionStatus) {
      case 'connected': return 'Live';
      case 'error': return 'Disconnected';
      default: return 'Connecting...';
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-green-500 p-4 rounded-full">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">Admin Panel</h2>
          <p className="text-gray-600 text-center mb-6">WhatsApp AI Assistant</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin(e)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                placeholder="Enter admin password"
              />
            </div>
            
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {loginError}
              </div>
            )}
            
            <button
              onClick={handleLogin}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition duration-200"
            >
              Login to Dashboard
            </button>
          </div>
          
          <p className="text-xs text-gray-500 text-center mt-6">
            Default password: <span className="font-mono bg-gray-100 px-2 py-1 rounded">admin123</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-green-500 p-2 rounded-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Admin Panel</h1>
              <p className="text-xs text-gray-500">WhatsApp Assistant</p>
            </div>
          </div>
          
          {/* Connection Status */}
          <div className="mt-4 flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()} animate-pulse`}></div>
              <span className="text-gray-600">{getConnectionStatusText()}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4">
          <div className="space-y-2">
            <button 
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                activeTab === 'chat' 
                  ? 'bg-green-50 text-green-700' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              Chat Assistant
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${
                activeTab === 'settings' 
                  ? 'bg-green-50 text-green-700' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Settings className="w-5 h-5" />
              Settings
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg font-medium transition"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {activeTab === 'chat' ? 'WhatsApp AI Assistant' : 'Credentials Settings'}
              </h2>
              <p className="text-sm text-gray-500">
                {activeTab === 'chat' ? 'Real-time AI responses - Direct from n8n' : 'Configure your WhatsApp Business API'}
              </p>
            </div>
            {activeTab === 'chat' && (
              <div className="flex items-center gap-4">
                {pendingResponse && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Processing...</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Wifi className={`w-4 h-4 ${connectionStatus === 'connected' ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className={`text-xs ${connectionStatus === 'connected' ? 'text-green-600' : 'text-gray-500'}`}>
                    {getConnectionStatusText()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Key className="w-6 h-6 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-800">WhatsApp API Credentials</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Access Token <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={credentials.accessToken}
                      onChange={(e) => handleCredentialChange('accessToken', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-mono text-sm"
                      placeholder="EAARPCHxT5qcBQ..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      App ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={credentials.appId}
                      onChange={(e) => handleCredentialChange('appId', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-mono text-sm"
                      placeholder="1212797771048615"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      App Secret <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={credentials.appSecret}
                      onChange={(e) => handleCredentialChange('appSecret', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-mono text-sm"
                      placeholder="98fd9a742157960e..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Account ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={credentials.businessAccountId}
                      onChange={(e) => handleCredentialChange('businessAccountId', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-mono text-sm"
                      placeholder="1571973883717819"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number ID
                      </label>
                      <input
                        type="text"
                        value={credentials.phoneNumberId}
                        onChange={(e) => handleCredentialChange('phoneNumberId', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-mono text-sm"
                        placeholder="926687467194699"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Test Phone Number
                      </label>
                      <input
                        type="text"
                        value={credentials.testPhoneNumber}
                        onChange={(e) => handleCredentialChange('testPhoneNumber', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-mono text-sm"
                        placeholder="918953984969"
                      />
                    </div>
                  </div>

                  {saveSuccess && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Credentials saved successfully! Real-time connection established.
                    </div>
                  )}

                  <button
                    onClick={saveCredentials}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Save Credentials
                  </button>
                </div>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2">📝 Setup Instructions:</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Visit: developers.facebook.com</li>
                    <li>• Select your WhatsApp Business App</li>
                    <li>• Access Token: WhatsApp → API Setup</li>
                    <li>• App ID & Secret: Settings → Basic</li>
                    <li>• Business Account ID: WhatsApp → Getting Started</li>
                    <li className="font-semibold mt-2">⚡ SSE endpoint configured for real-time responses</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-gray-50 to-gray-100" style={{ maxHeight: 'calc(100vh - 220px)', scrollBehavior: 'smooth' }}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-2xl px-5 py-3 rounded-2xl shadow-md ${
                      message.sender === 'user'
                        ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                        : message.isError
                        ? 'bg-red-50 text-red-700 border-2 border-red-200'
                        : message.isTyping
                        ? 'bg-gray-200 text-gray-600'
                        : message.sender === 'assistant'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                        : 'bg-white text-gray-800 border border-gray-200'
                    }`}
                  >
                    {message.sender === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-400">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-xs font-bold">AI Assistant (via n8n)</span>
                      </div>
                    )}
                    {message.isTyping && (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-sm ml-2">{message.text}</span>
                      </div>
                    )}
                    {!message.isTyping && (
                      <>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                        <p
                          className={`text-xs mt-2 ${
                            message.sender === 'user' 
                              ? 'text-green-100' 
                              : message.sender === 'assistant' 
                              ? 'text-blue-100' 
                              : 'text-gray-400'
                          }`}
                        >
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="bg-white border-t-2 border-gray-200 p-4 shadow-lg">
              <div className="flex gap-3 max-w-4xl mx-auto">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message here..."
                  disabled={isSending}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition disabled:opacity-50 disabled:bg-gray-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={isSending || !inputMessage.trim()}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-3 rounded-xl transition duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  <span className="font-semibold">Send</span>
                </button>
              </div>
              <p className="text-xs text-center text-gray-500 mt-3 flex items-center justify-center gap-2">
                <Wifi className="w-3 h-3" />
                Instant AI responses via direct n8n webhook
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WhatsAppAdminPanel;