import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabase-client";
import style from "./UploadImage.module.css";

type Props = {
  onUpload: (path: string) => void;
  currentImage?: string | null;
  previewUrl?: string|null;
};

function UploadImage({ onUpload, currentImage ,previewUrl}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(previewUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadedPathRef=useRef<string | null>(null);

  useEffect(() => {
    if (previewUrl) {
      setPreview(previewUrl);
    }
  }, [previewUrl]);
  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    const MAX_SIZE = 300 * 1024;
    if (file.size > MAX_SIZE) {
      setError("Image must be less than 200kb");
      return;
    }
    setError(null);

    setPreview(URL.createObjectURL(file));
    setLoading(true);


    try {
      const pathToDelete=uploadedPathRef.current ?? currentImage
      
      if(pathToDelete)
        {
          const {error:deleteError}=await supabase
          .storage
          .from("profile_image")
          .remove([pathToDelete])
          
          if(deleteError){
            console.log("Delete Error: ",deleteError.message)
          }
          else{
            console.log("Deleted")
          }
        }
        
        const fileName = `${Date.now()}_${file.name}`;
      
        const { data,error } = await supabase.storage
      .from("profile_image")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: true,
      });
      
      if (error) {
        console.log(error.message);
        setError(error.message);
        setLoading(false);
        return;
      }
      

      onUpload(data.path);
      setLoading(false);
    }
    catch(err){
      console.log(err);
    }
  }

  return (
    <div className={style.wrapper}>
      <div
        className={style["circle-wrap"]}
        onClick={() => inputRef.current?.click()}
      >
        <div className={style.circle}>
          {/* 1️⃣ Default avatar (only when no preview) */}
          {!preview && (
            <div className={style.placeholder}>
              <svg width="66" height="66" viewBox="0 0 72 72" fill="none">
                <circle cx="36" cy="28" r="14" fill="#9ca3af" />
                <ellipse cx="36" cy="62" rx="24" ry="16" fill="#9ca3af" />
              </svg>
            </div>
          )}

          {/* 2️⃣ Preview image (on top) */}
          {preview && (
            <img
              src={preview}
              alt="Profile preview"
              className={style["preview-img"]}
            />
          )}

          {/* 3️⃣ Camera icon (always on top-right) */}
        </div>
          <div className={style["camera-svg"]}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="13" r="3" />
              <path d="M20 6h-3.2L15 4H9L7.2 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" />
            </svg>
          </div>
      </div>
      {error && <p className={style["error-text"]}>{error}</p>}
      {loading && <p className={style["uploading-text"]}>Uploading...</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
      />
    </div>
  );
}

export default UploadImage;
