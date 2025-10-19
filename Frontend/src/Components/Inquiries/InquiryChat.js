import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from "../../Contexts/AuthContext";
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Send, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  User,
  UserCheck,
  Loader
} from 'lucide-react';
import './inquiry-chat.css';

const InquiryChat = () => {
  const { token, user } = useAuth();
  const { id } = useParams();
  const [inquiry, setInquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [inquiry?.messages]);

  useEffect(() => {
    const fetchInquiry = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5000/api/inquiries/${id}/messages`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setInquiry(data.inquiry);
        } else {
          const errorData = await response.json();
          setError(errorData.message || 'Failed to fetch inquiry details');
        }
      } catch (err) {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (token && id) {
      fetchInquiry();
    }
  }, [token, id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const response = await fetch(`http://localhost:5000/api/inquiries/${id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: newMessage.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        // Add the new message to the inquiry
        setInquiry(prev => ({
          ...prev,
          messages: [...prev.messages, data.newMessage]
        }));
        setNewMessage('');
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to send message');
      }
    } catch (err) {
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <AlertCircle className="text-orange-500" size={20} />;
      case 'in_progress': return <Clock className="text-blue-500" size={20} />;
      case 'resolved': return <CheckCircle className="text-green-500" size={20} />;
      default: return <AlertCircle className="text-gray-500" size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'status-open';
      case 'in_progress': return 'status-progress';
      case 'resolved': return 'status-resolved';
      default: return 'status-open';
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMessageTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="inquiry-chat-container">
        <div className="chat-loading">
          <Loader className="animate-spin" size={24} />
          <span>Loading conversation...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inquiry-chat-container">
        <div className="chat-error">
          <AlertCircle size={24} />
          <span>{error}</span>
          <Link to="/profile/inquiries" className="btn-primary">
            Back to Inquiries
          </Link>
        </div>
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="inquiry-chat-container">
        <div className="chat-error">
          <MessageSquare size={24} />
          <span>Inquiry not found</span>
          <Link to="/profile/inquiries" className="btn-primary">
            Back to Inquiries
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="inquiry-chat-container">
      {/* Chat Header */}
      <div className="chat-header">
        <Link to="/profile/inquiries" className="back-btn">
          <ArrowLeft size={16} />
          Back to Inquiries
        </Link>
        
        <div className="chat-title">
          <div className="inquiry-code">#{inquiry.inquiryCode}</div>
          <h1>{inquiry.subject}</h1>
          <div className={`status-badge ${getStatusColor(inquiry.status)}`}>
            {getStatusIcon(inquiry.status)}
            <span>{inquiry.status.replace('_', ' ')}</span>
          </div>
        </div>

        {inquiry.assignedTo && (
          <div className="assigned-info">
            <UserCheck size={16} />
            <span>Assigned to: {inquiry.assignedToName || inquiry.assignedTo}</span>
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="chat-messages">
        {inquiry.messages && inquiry.messages.length > 0 ? (
          inquiry.messages.map((message, index) => (
            <div 
              key={message._id || index} 
              className={`message ${message.senderType === 'patient' ? 'message-patient' : 'message-receptionist'}`}
            >
              <div className="message-avatar">
                {message.senderType === 'patient' ? (
                  <User size={16} />
                ) : (
                  <UserCheck size={16} />
                )}
              </div>
              
              <div className="message-content">
                <div className="message-header">
                  <span className="sender-name">
                    {message.senderType === 'patient' 
                      ? (message.senderName || 'You') 
                      : (message.senderName || 'Support Team')
                    }
                  </span>
                  <span className="message-time">
                    {formatMessageTime(message.timestamp)}
                  </span>
                </div>
                
                <div className="message-text">
                  {message.message.split('\n').map((line, lineIndex) => (
                    <p key={lineIndex}>{line}</p>
                  ))}
                </div>

                {message.messageType === 'appointment_change_request' && message.metadata && (
                  <div className="message-metadata">
                    <div className="metadata-item">
                      <strong>Appointment:</strong> {message.metadata.appointmentCode}
                    </div>
                    {message.metadata.requestedChanges && (
                      <div className="metadata-item">
                        <strong>Requested Changes:</strong> {message.metadata.requestedChanges}
                      </div>
                    )}
                    {message.metadata.reason && (
                      <div className="metadata-item">
                        <strong>Reason:</strong> {message.metadata.reason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="no-messages">
            <MessageSquare size={48} />
            <p>No messages yet</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      {inquiry.status !== 'resolved' && (
        <div className="chat-input-container">
          <form onSubmit={handleSendMessage} className="chat-input-form">
            <div className="input-group">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                rows={3}
                disabled={sending}
                className="message-input"
              />
              <button 
                type="submit" 
                disabled={!newMessage.trim() || sending}
                className="send-btn"
              >
                {sending ? (
                  <Loader size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {inquiry.status === 'resolved' && (
        <div className="chat-resolved">
          <CheckCircle size={20} />
          <span>This inquiry has been resolved and is no longer accepting new messages.</span>
        </div>
      )}
    </div>
  );
};

export default InquiryChat;
