import React, { useState, useEffect } from 'react';
import './unregistered-user-management.css';
import { getJSON, postJSON, putJSON } from '../api';

const UnregisteredUserManagement = () => {
  const [unregisteredUsers, setUnregisteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    age: '',
    identityNumber: '',
    notes: ''
  });

  useEffect(() => {
    fetchUnregisteredUsers();
  }, []);

  const fetchUnregisteredUsers = async () => {
    setLoading(true);
    try {
      const response = await getJSON('/unregistered-patients');
      setUnregisteredUsers(response.items || []);
    } catch (error) {
      console.error('Error fetching unregistered users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await getJSON(`/unregistered-patients?search=${searchTerm}`);
      setUnregisteredUsers(response.items || []);
    } catch (error) {
      console.error('Error searching unregistered users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      age: '',
      identityNumber: '',
      notes: ''
    });
    setSelectedUser(null);
    setShowModal(true);
  };

  const handleEditUser = (user) => {
    setFormData({
      name: user.name || '',
      phone: user.phone || '',
      email: user.email || '',
      age: user.age || '',
      identityNumber: user.identityNumber || '',
      notes: user.notes || ''
    });
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (selectedUser) {
        // Update existing user
        await putJSON(`/unregistered-patients/${selectedUser.unregisteredPatientCode}`, formData);
      } else {
        // Create new user
        await postJSON('/unregistered-patients', formData);
      }
      setShowModal(false);
      fetchUnregisteredUsers();
    } catch (error) {
      console.error('Error saving unregistered user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const filteredUsers = unregisteredUsers.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone?.includes(searchTerm) ||
    user.unregisteredPatientCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="unregistered-user-management">
      <div className="header">
        <h2>Unregistered Users Management</h2>
        <button className="btn-primary" onClick={handleCreateUser}>
          Add New User
        </button>
      </div>

      <div className="search-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by name, phone, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="btn-search">Search</button>
        </div>
      </div>

      <div className="users-table">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Age</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user._id}>
                  <td>{user.unregisteredPatientCode}</td>
                  <td>{user.name}</td>
                  <td>{user.phone}</td>
                  <td>{user.email || '-'}</td>
                  <td>{user.age || '-'}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <button 
                      className="btn-edit" 
                      onClick={() => handleEditUser(user)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{selectedUser ? 'Edit User' : 'Add New User'}</h3>
              <button 
                className="btn-close" 
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Age</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  min="0"
                  max="120"
                />
              </div>
              <div className="form-group">
                <label>Identity Number</label>
                <input
                  type="text"
                  name="identityNumber"
                  value={formData.identityNumber}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : (selectedUser ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnregisteredUserManagement;
