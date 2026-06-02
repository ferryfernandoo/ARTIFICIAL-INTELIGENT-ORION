import React from 'react';
import './FileTypeSelector.css';

const FileTypeSelector = ({ isOpen, onClose, userName, onSelectType, userLanguage = 'id' }) => {
  if (!isOpen) return null;

  const handleSelect = (fileType) => {
    onSelectType(fileType);
    onClose();
  };

  return (
    <div className="file-type-selector-overlay">
      <div className="file-type-selector-modal">
        <div className="selector-header">
          <h2>
            {userLanguage === 'id' 
              ? `Apa yang mau kamu buat, ${userName}?` 
              : `What do you want to create, ${userName}?`}
          </h2>
          <button className="selector-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="selector-body">
          <div className="file-type-grid">
            {/* Word Document */}
            <button
              className="file-type-card word"
              onClick={() => handleSelect('word')}
              title={userLanguage === 'id' ? 'Buat dokumen Word' : 'Create Word document'}
            >
              <div className="file-type-icon">📄</div>
              <div className="file-type-name">
                {userLanguage === 'id' ? 'Word' : 'Word'}
              </div>
              <div className="file-type-desc">
                {userLanguage === 'id' ? 'Dokumen teks' : 'Text document'}
              </div>
            </button>

            {/* Excel Spreadsheet */}
            <button
              className="file-type-card excel"
              onClick={() => handleSelect('excel')}
              title={userLanguage === 'id' ? 'Buat spreadsheet Excel' : 'Create Excel spreadsheet'}
            >
              <div className="file-type-icon">📊</div>
              <div className="file-type-name">
                {userLanguage === 'id' ? 'Excel' : 'Excel'}
              </div>
              <div className="file-type-desc">
                {userLanguage === 'id' ? 'Tabel & data' : 'Tables & data'}
              </div>
            </button>

            {/* PowerPoint Presentation */}
            <button
              className="file-type-card ppt"
              onClick={() => handleSelect('ppt')}
              title={userLanguage === 'id' ? 'Buat presentasi PowerPoint' : 'Create PowerPoint presentation'}
            >
              <div className="file-type-icon">🎭</div>
              <div className="file-type-name">
                {userLanguage === 'id' ? 'PowerPoint' : 'PowerPoint'}
              </div>
              <div className="file-type-desc">
                {userLanguage === 'id' ? 'Presentasi' : 'Presentation'}
              </div>
            </button>
          </div>
        </div>

        <div className="selector-footer">
          <button 
            className="selector-cancel-btn" 
            onClick={onClose}
          >
            {userLanguage === 'id' ? 'Batal' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileTypeSelector;
