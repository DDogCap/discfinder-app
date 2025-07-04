import React, { useState, useRef } from 'react';
import './ImageUpload.css';

interface ImageUploadProps {
  onImagesChange: (files: File[]) => void;
  maxImages?: number;
  maxSizePerImage?: number; // in MB
  existingImages?: string[];
  disabled?: boolean;
}

interface ImagePreview {
  file: File;
  url: string;
  id: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onImagesChange,
  maxImages = 2,
  maxSizePerImage = 10,
  existingImages = [],
  disabled = false
}) => {
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return 'Please select only image files';
    }

    // Check file size
    const maxSizeBytes = maxSizePerImage * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `Image size must be less than ${maxSizePerImage}MB`;
    }

    // Check supported formats
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
      return 'Supported formats: JPEG, PNG, WebP';
    }

    return null;
  };

  const handleFiles = (files: FileList) => {
    setError('');
    const newFiles: File[] = [];
    const newPreviews: ImagePreview[] = [];

    // Check total number of images
    const totalImages = imagePreviews.length + existingImages.length + files.length;
    if (totalImages > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validationError = validateFile(file);
      
      if (validationError) {
        setError(validationError);
        return;
      }

      newFiles.push(file);
      
      // Create preview
      const url = URL.createObjectURL(file);
      newPreviews.push({
        file,
        url,
        id: `${Date.now()}-${i}`
      });
    }

    const updatedPreviews = [...imagePreviews, ...newPreviews];
    setImagePreviews(updatedPreviews);
    
    // Extract files and call parent callback
    const allFiles = updatedPreviews.map(preview => preview.file);
    onImagesChange(allFiles);
  };

  const removeImage = (id: string) => {
    const updatedPreviews = imagePreviews.filter(preview => {
      if (preview.id === id) {
        URL.revokeObjectURL(preview.url);
        return false;
      }
      return true;
    });
    
    setImagePreviews(updatedPreviews);
    const allFiles = updatedPreviews.map(preview => preview.file);
    onImagesChange(allFiles);
    setError('');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (disabled) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const canAddMore = imagePreviews.length + existingImages.length < maxImages;

  return (
    <div className="image-upload">
      <div className="image-upload-header">
        <label className="image-upload-label">
          Disc Images (Optional)
        </label>
        <span className="image-upload-info">
          {imagePreviews.length + existingImages.length}/{maxImages} images • Max {maxSizePerImage}MB each
        </span>
      </div>

      {error && (
        <div className="image-upload-error">
          {error}
        </div>
      )}

      {/* Existing Images */}
      {existingImages.length > 0 && (
        <div className="existing-images">
          <h4>Current Images:</h4>
          <div className="image-previews">
            {existingImages.map((url, index) => (
              <div key={`existing-${index}`} className="image-preview">
                <img src={url} alt={`Existing disc ${index + 1}`} />
                <span className="image-label">Existing</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Image Previews */}
      {imagePreviews.length > 0 && (
        <div className="image-previews">
          {imagePreviews.map((preview) => (
            <div key={preview.id} className="image-preview">
              <img src={preview.url} alt="Disc preview" />
              <button
                type="button"
                className="remove-image"
                onClick={() => removeImage(preview.id)}
                disabled={disabled}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      {canAddMore && (
        <div
          className={`image-upload-area ${dragActive ? 'drag-active' : ''} ${disabled ? 'disabled' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          <div className="upload-content">
            <div className="upload-icon">📷</div>
            <div className="upload-text">
              <p>Click to upload or drag and drop</p>
              <p className="upload-subtext">JPEG, PNG, WebP up to {maxSizePerImage}MB</p>
            </div>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleInputChange}
            style={{ display: 'none' }}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
};
