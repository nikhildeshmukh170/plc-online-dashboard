import React, { useEffect, useState } from 'react';
import { getTags, createTag, updateTag, deleteTag } from '../api';
import { toast } from 'react-toastify';
import './TagManager.css';

const TagManager = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ tag: '', address: 0, type: 'float', function: 'holding', label: '', unit: '' });
  const [editingId, setEditingId] = useState(null);

  const loadTags = async () => {
    setLoading(true);
    try {
      const res = await getTags();
      setTags(res);
    } catch (err) {
      toast.error('Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  // Listen to dashboard refresh events triggered elsewhere to reload tags
  useEffect(() => {
    const onRefresh = () => loadTags();
    window.addEventListener('dashboard-refresh', onRefresh);
    return () => window.removeEventListener('dashboard-refresh', onRefresh);
  }, []);

  // listen to nav events and scroll into view
  useEffect(() => {
    const onNav = (ev) => {
      if (!ev || !ev.detail) return;
      if (ev.detail.id === 'tags') {
        const el = document.querySelector('.tag-manager');
        el && el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('dashboard-nav', onNav);
    return () => window.removeEventListener('dashboard-nav', onNav);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateTag(editingId, form);
        toast.success('Updated tag');
      } else {
        await createTag(form);
        toast.success('Created tag');
      }
      // Dispatch a refresh signal so other components (table/bridge UI) can react
      const ev = new Event('dashboard-refresh');
      window.dispatchEvent(ev);
      setForm({ tag: '', address: 0, type: 'float', function: 'holding', label: '', unit: '' });
      setEditingId(null);
      loadTags();
    } catch (err) {
      toast.error('Failed to save tag');
    }
  };

  const handleEdit = (t) => {
    setEditingId(t.id);
    setForm({ tag: t.tag, address: t.address, type: t.type, function: t.function, label: t.label || '', unit: t.unit || '' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this tag?')) return;
    try {
      await deleteTag(id);
      toast.success('Tag deleted');
      loadTags();
      const ev = new Event('dashboard-refresh');
      window.dispatchEvent(ev);
    } catch (err) {
      toast.error('Failed to delete tag');
    }
  };

  return (
    <div className="tag-manager" id="tag-manager">
      <h3>PLC Tag Configuration</h3>
      <form onSubmit={handleSubmit} className="tag-form">
        <div>
          <label>Tag</label>
          <input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} required />
        </div>
        <div>
          <label>Address</label>
          <input type="number" value={form.address} onChange={(e) => setForm({ ...form, address: Number(e.target.value) })} required />
        </div>
        <div>
          <label>Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="float">float</option>
            <option value="int16">int16</option>
            <option value="uint16">uint16</option>
            <option value="boolean">boolean</option>
          </select>
        </div>
        <div>
          <label>Function</label>
          <select value={form.function} onChange={(e) => setForm({ ...form, function: e.target.value })}>
            <option value="holding">holding</option>
            <option value="input">input</option>
            <option value="coil">coil</option>
            <option value="discrete">discrete</option>
          </select>
        </div>
        <div>
          <label>Label (optional)</label>
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </div>
        <div>
          <label>Unit (optional)</label>
          <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </div>
        <div className="actions">
          <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Add'}</button>
          {editingId ? (
            <button type="button" className="btn btn-secondary" onClick={() => { setEditingId(null); setForm({ tag: '', address: 0, type: 'float', function: 'holding', label: ''}); }}>Cancel</button>
          ) : null}
        </div>
      </form>

      <div className="tag-list">
        {loading ? <div>Loading...</div> : (
          <table>
            <thead>
              <tr><th>Tag</th><th>Address</th><th>Type</th><th>Function</th><th>Label</th><th>Unit</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {tags.map(t => (
                <tr key={t.id}>
                  <td>{t.tag}</td>
                  <td>{t.address}</td>
                  <td>{t.type}</td>
                  <td>{t.function}</td>
                  <td>{t.label}</td>
                  <td>{t.unit || ''}</td>
                  <td>
                    <button className="btn" onClick={() => handleEdit(t)}>Edit</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(t.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TagManager;