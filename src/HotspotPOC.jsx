// React Hotspot POC
// Single-file POC component using React + TailwindCSS + framer-motion (optional)
// Save this as src/HotspotPOC.jsx and import in your App (or replace App.jsx contents)
// Features:
// - Upload multiple images
// - Place multiple hotspots per image (click to add)
// - Each hotspot has comment (add/edit/remove)
// - Hotspot positions are stored as percentages (responsive)
// - LocalStorage persistence for POC
// - Guided-tour style Prev/Next navigation + Skip
// - Simple animations using framer-motion

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

// --------------------- Types (for clarity) ---------------------
// ImageItem: { id: string, src: string, filename: string, hotspots: Hotspot[] }
// Hotspot: { id: string, x: number /*%*/, y: number /*%*/, comment: string }

// --------------------- Helpers ---------------------
const uid = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

const STORAGE_KEY = "hotspot_poc_v1";

// --------------------- ImageUploader ---------------------
function ImageUploader({ onAddImages }) {
  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const readers = files.map((file) =>
      new Promise((res) => {
        const reader = new FileReader();
        reader.onload = () =>
          res({ id: uid("img"), src: reader.result, filename: file.name, hotspots: [] });
        reader.readAsDataURL(file);
      })
    );
    Promise.all(readers).then(onAddImages);
    e.target.value = null;
  };

  return (
    <div className="flex gap-2 items-center">
      <label className="px-3 py-2 bg-slate-700 text-white rounded cursor-pointer"> 
        Upload images
        <input className="hidden" type="file" accept="image/*" multiple onChange={handleFiles} />
      </label>
      <p className="text-sm text-gray-400">PNG / JPG — multiple allowed</p>
    </div>
  );
}

// --------------------- HotspotMarker ---------------------
function HotspotMarker({ x, y, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${
        active ? "bg-blue-500" : "bg-red-500 animate-pulse"
      }`}
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-label="hotspot"
    />
  );
}

// --------------------- Tooltip / Editor ---------------------
function HotspotEditor({ hotspot, onChangeComment, onDelete, onClose, positionRef }) {
  // positionRef is a DOM rect {left, top, width, height} of image container used for placing tooltip
  // We'll position tooltip near the hotspot using absolute coordinates

  if (!positionRef) return null;

  const left = (hotspot.x / 100) * positionRef.width + positionRef.left;
  const top = (hotspot.y / 100) * positionRef.height + positionRef.top;

  // We'll render a fixed-position tooltip near calculated coords
  return (
    <div style={{ position: "fixed", left: left, top: top, zIndex: 60 }}>
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18 }}
        className="w-72 bg-white rounded-xl p-3 shadow-2xl text-sm"
      >
        <div className="flex justify-between items-start gap-2">
          <strong className="text-gray-900">Hotspot</strong>
          <div className="flex gap-2">
            <button className="text-xs text-slate-500" onClick={onClose}>Close</button>
            <button className="text-xs text-red-500" onClick={onDelete}>Delete</button>
          </div>
        </div>

        <textarea
          value={hotspot.comment}
          onChange={(e) => onChangeComment(e.target.value)}
          placeholder="Add a comment or description..."
          className="w-full mt-2 text-sm p-2 bg-gray-50 rounded-md border text-black" 
          rows={3}
        />
      </motion.div>
    </div>
  );
}

// --------------------- HotspotCanvas ---------------------
function HotspotCanvas({ image, onUpdateImage, onStartTour, isTourActive }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [containerRect, setContainerRect] = useState(null);

  useEffect(() => {
    const calc = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setContainerRect(rect);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [image]);

  const handleAddHotspot = (e) => {
    if (!imgRef.current || !containerRef.current) return;
    // Only allow adding when not in tour
    if (isTourActive) return;

    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newHotspot = { id: uid("hs"), x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, comment: "" };

    const updated = { ...image, hotspots: [...image.hotspots, newHotspot] };
    onUpdateImage(updated);
    setSelectedHotspot(newHotspot.id);
  };

  const handleUpdateComment = (hotspotId, comment) => {
    const updatedHotspots = image.hotspots.map((h) => (h.id === hotspotId ? { ...h, comment } : h));
    onUpdateImage({ ...image, hotspots: updatedHotspots });
  };

  const handleDeleteHotspot = (hotspotId) => {
    const updated = image.hotspots.filter((h) => h.id !== hotspotId);
    onUpdateImage({ ...image, hotspots: updated });
    setSelectedHotspot(null);
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex gap-3 items-center">
        <div className="flex-1 text-sm text-gray-300">{image.filename}</div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded bg-slate-800 text-white text-sm"
            onClick={() => onStartTour(image.id)}
            disabled={image.hotspots.length === 0}
          >
            Start tour
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative bg-black/5 rounded overflow-hidden border">
        <img
          ref={imgRef}
          src={image.src}
          alt={image.filename}
          className="w-full h-auto max-h-[60vh] object-contain block"
          onClick={handleAddHotspot}
          onLoad={() => {
            if (containerRef.current) setContainerRect(containerRef.current.getBoundingClientRect());
          }}
        />

        {/* Markers */}
        {image.hotspots.map((h) => (
          <HotspotMarker
            key={h.id}
            x={h.x}
            y={h.y}
            active={selectedHotspot === h.id}
            onClick={(evt) => {
              evt.stopPropagation();
              setSelectedHotspot(h.id);
            }}
          />
        ))}

        {/* Editor Tooltip */}
        {selectedHotspot && (
          <HotspotEditor
            hotspot={image.hotspots.find((s) => s.id === selectedHotspot)}
            onChangeComment={(val) => handleUpdateComment(selectedHotspot, val)}
            onDelete={() => handleDeleteHotspot(selectedHotspot)}
            onClose={() => setSelectedHotspot(null)}
            positionRef={containerRect}
          />
        )}
      </div>
    </div>
  );
}

// --------------------- Tour Controller ---------------------
function TourController({ images, activeImageId, setActiveImageId, onExit }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    // reset step when image changes
    setStepIndex(0);
  }, [activeImageId]);

  if (!activeImageId) return null;

  const image = images.find((i) => i.id === activeImageId);
  if (!image || image.hotspots.length === 0) return null;

  const next = () => setStepIndex((s) => Math.min(s + 1, image.hotspots.length - 1));
  const prev = () => setStepIndex((s) => Math.max(s - 1, 0));

  const hs = image.hotspots[stepIndex];

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* dim overlay */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onExit} />

      {/* spotlight + tooltip */}
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}>
        {/* Tooltip box near center for simplicity */}
        <div className="absolute" style={{ left: `${hs.x}%`, top: `${hs.y}%`, transform: "translate(-50%, -140%)" }}>
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="w-80 bg-white p-3 rounded-xl shadow-xl pointer-events-auto">
            <div className="flex justify-between items-start">
              <div className="text-sm font-semibold">Step {stepIndex + 1} / {image.hotspots.length}</div>
              <button className="text-xs text-slate-500" onClick={onExit}>End</button>
            </div>
            <p className="text-sm mt-2">{hs.comment || "No description provided."}</p>
            <div className="flex justify-between items-center mt-3">
              <div>
                <button onClick={prev} className="px-3 py-1 text-sm bg-gray-200 rounded mr-2" disabled={stepIndex === 0}>Prev</button>
                <button onClick={next} className="px-3 py-1 text-sm bg-blue-600 text-white rounded" disabled={stepIndex === image.hotspots.length - 1}>Next</button>
              </div>
              <div className="text-xs text-gray-400">Hotspot</div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// --------------------- Main App ---------------------
export default function AppHotspotPOC() {
  const [images, setImages] = useState([]);
  const [activeImageId, setActiveImageId] = useState(null);
  const [tourImageId, setTourImageId] = useState(null);

  useEffect(() => {
    // load from localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setImages(JSON.parse(raw));
        if (JSON.parse(raw).length > 0) setActiveImageId(JSON.parse(raw)[0].id);
      }
    } catch (e) {
      console.warn("Could not parse storage", e);
    }
  }, []);

  useEffect(() => {
    // persist
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
  }, [images]);

  const handleAddImages = (newImages) => {
    setImages((prev) => {
      const merged = [...prev, ...newImages];
      if (!activeImageId && merged.length > 0) setActiveImageId(merged[0].id);
      return merged;
    });
  };

  const handleUpdateImage = (updatedImage) => {
    setImages((prev) => prev.map((img) => (img.id === updatedImage.id ? updatedImage : img)));
  };

  const handleDeleteImage = (id) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
    if (activeImageId === id) setActiveImageId(null);
  };

  const startTour = (imageId) => setTourImageId(imageId);
  const endTour = () => setTourImageId(null);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Hotspot POC</h1>
          <ImageUploader onAddImages={handleAddImages} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <div className="bg-slate-800 rounded p-3 space-y-3">
              <h3 className="text-sm font-medium">Images</h3>
              <div className="space-y-2 max-h-[60vh] overflow-auto">
                {images.map((img) => (
                  <div key={img.id} className={`p-2 rounded cursor-pointer flex items-center gap-2 ${activeImageId === img.id ? "bg-slate-700" : "hover:bg-slate-700/40"}`} onClick={() => setActiveImageId(img.id)}>
                    <img src={img.src} alt={img.filename} className="w-12 h-8 object-cover rounded" />
                    <div className="flex-1">
                      <div className="text-xs font-medium">{img.filename}</div>
                      <div className="text-xs text-gray-400">{img.hotspots.length} hotspots</div>
                    </div>
                    <button className="text-xs text-red-400" onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.id); }}>Delete</button>
                  </div>
                ))}

                {images.length === 0 && <div className="text-xs text-gray-400">No images yet. Upload one to start placing hotspots.</div>}
              </div>
            </div>

            <div className="mt-4 bg-slate-800 rounded p-3 text-sm space-y-2">
              <div><strong>Quick tips</strong></div>
              <ul className="text-xs text-gray-400 list-disc list-inside space-y-1">
                <li>Click on image to add a hotspot.</li>
                <li>Click marker to edit comment or delete.</li>
                <li>Start tour to walkthrough hotspots (uses overlay).</li>
                <li>Hotspots are responsive — positions saved as %.</li>
              </ul>
            </div>
          </div>

          <div className="col-span-2">
            <div className="bg-slate-800 rounded p-4">
              {activeImageId ? (
                <HotspotCanvas
                  image={images.find((i) => i.id === activeImageId)}
                  onUpdateImage={handleUpdateImage}
                  onStartTour={startTour}
                  isTourActive={!!tourImageId}
                />
              ) : (
                <div className="h-[60vh] flex items-center justify-center text-gray-400">Select an image to start</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tour overlay */}
      {tourImageId && (
        <TourController images={images} activeImageId={tourImageId} setActiveImageId={setActiveImageId} onExit={endTour} />
      )}
    </div>
  );
}

/*
How to use:
1. Ensure your project has Tailwind CSS configured (or replace classes with your CSS).
2. Install framer-motion if you want animations: `yarn add framer-motion` or `npm i framer-motion`.
3. Put this file in src/, import & render <AppHotspotPOC/> from src/index.jsx.

Notes & potential improvements:
- Persist to backend instead of localStorage.
- Improve tooltip placement (avoid going off-screen).
- Add drag-to-move hotspots and fine-grain controls.
- Add image cropping / zoom support and recalculate coords accordingly.
- Add export/import (JSON) for sharing hotspot data.
*/
