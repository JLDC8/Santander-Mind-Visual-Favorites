import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// --- CONSTANTS ---
const ORBIT_RADIUS = 180;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3.0;

// --- DATA TYPES ---
interface Favorite {
  id: string;
  type: 'web' | 'teams';
  name: string;
  url: string;
  imageUrl: string;
  openBehavior?: 'modal' | 'newTab';
}

interface Group {
  id: string;
  name: string;
  favorites: Favorite[];
  x: number;
  y: number;
}

interface ViewState {
  zoom: number;
  pan: { x: number; y: number };
}

// --- MOCK DATA for initial state ---
const getInitialData = (): Group[] => {
  const savedData = localStorage.getItem('visualFavorites');
  if (savedData) {
    return JSON.parse(savedData);
  }
  return [
    {
      id: 'group-1', name: "Work Tools", x: 400, y: 300,
      favorites: [
        { id: 'fav-1', type: 'web', name: 'Company Portal', url: 'https://www.google.com/search?q=santander', imageUrl: 'https://placehold.co/100x100/EC0000/FFFFFF/png?text=Portal', openBehavior: 'modal' },
        { id: 'fav-2', type: 'web', name: 'Project Tracker', url: '#', imageUrl: 'https://placehold.co/100x100/333333/FFFFFF/png?text=Tracker', openBehavior: 'newTab' },
      ],
    },
    {
      id: 'group-2', name: "Team Contacts", x: 800, y: 500,
      favorites: [
        { id: 'fav-3', type: 'teams', name: 'Alice Johnson', url: '#', imageUrl: 'https://i.pravatar.cc/150?u=alice' },
        { id: 'fav-4', type: 'teams', name: 'Bob Williams', url: '#', imageUrl: 'https://i.pravatar.cc/150?u=bob' },
      ],
    },
  ];
};

// --- APP COMPONENT ---
const App: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>(getInitialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
  
  const rootRef = useRef<HTMLDivElement>(null);
  const interactionState = useRef({
    isPanning: false,
    isDraggingGroup: false,
    draggedGroupIndex: -1,
    startPos: { x: 0, y: 0 },
    initialGroupPos: { x: 0, y: 0 },
  });

  // Drag and drop for items
  const dragItem = useRef<any>(null);
  const dragOverGroup = useRef<string | null>(null);

  // Persist data to localStorage
  useEffect(() => {
    localStorage.setItem('visualFavorites', JSON.stringify(groups));
  }, [groups]);

  // --- Canvas Interaction Handlers ---
  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const { isPanning, isDraggingGroup, startPos, draggedGroupIndex, initialGroupPos } = interactionState.current;
      
      if (isPanning) {
        const dx = e.clientX - startPos.x;
        const dy = e.clientY - startPos.y;
        setView(prev => ({ ...prev, pan: { x: prev.pan.x + dx, y: prev.pan.y + dy } }));
        interactionState.current.startPos = { x: e.clientX, y: e.clientY };
      } else if (isDraggingGroup) {
        const dx = (e.clientX - startPos.x) / view.zoom;
        const dy = (e.clientY - startPos.y) / view.zoom;
        setGroups(prev => prev.map((g, index) => 
            index === draggedGroupIndex ? { ...g, x: initialGroupPos.x + dx, y: initialGroupPos.y + dy } : g
        ));
      }
    };
    
    const handleMouseUp = () => {
      interactionState.current.isPanning = false;
      interactionState.current.isDraggingGroup = false;
      rootEl.classList.remove('panning');
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [view.zoom]);
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? view.zoom * zoomFactor : view.zoom / zoomFactor;
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    
    const rect = rootRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldX = (mouseX - view.pan.x) / view.zoom;
    const worldY = (mouseY - view.pan.y) / view.zoom;
    
    const newPanX = mouseX - worldX * clampedZoom;
    const newPanY = mouseY - worldY * clampedZoom;
    
    setView({ zoom: clampedZoom, pan: { x: newPanX, y: newPanY } });
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
        interactionState.current.isPanning = true;
        interactionState.current.startPos = { x: e.clientX, y: e.clientY };
        rootRef.current?.classList.add('panning');
    }
  };

  const handleGroupMouseDown = (e: React.MouseEvent, groupIndex: number) => {
    e.stopPropagation();
    interactionState.current.isDraggingGroup = true;
    interactionState.current.draggedGroupIndex = groupIndex;
    interactionState.current.startPos = { x: e.clientX, y: e.clientY };
    interactionState.current.initialGroupPos = { x: groups[groupIndex].x, y: groups[groupIndex].y };
  };

  // --- Content Management ---
  const handleAddGroup = () => {
    const newGroupName = prompt("Enter new group name:");
    if (newGroupName) {
      setGroups(prev => [...prev, { id: `group-${Date.now()}`, name: newGroupName, favorites: [], x: 200, y: 200 }]);
    }
  };

  const handleOpenModal = (groupId: string) => {
    setActiveGroupId(groupId);
    setIsModalOpen(true);
  };

  const handleAddFavorite = (favorite: Omit<Favorite, 'id'>) => {
    if (!activeGroupId) return;
    const newFavorite = { ...favorite, id: `fav-${Date.now()}` };
    setGroups(prev =>
      prev.map(group =>
        group.id === activeGroupId ? { ...group, favorites: [...group.favorites, newFavorite] } : group
      )
    );
    setIsModalOpen(false);
  };
  
  const handleFavoriteClick = (e: React.MouseEvent, fav: Favorite) => {
      e.preventDefault();
      if (fav.type === 'web' && fav.openBehavior === 'modal') {
          setIframeUrl(fav.url);
      } else {
          window.open(fav.url, '_blank', 'noopener,noreferrer');
      }
  };

  // --- DRAG AND DROP FAVORITES ---
  const handleDragStart = (e: React.DragEvent, fromGroup: Group, item: Favorite) => {
    dragItem.current = { fromGroupId: fromGroup.id, item };
    setTimeout(() => { e.currentTarget.classList.add('dragging'); }, 0);
  };

  const handleDragEnterGroup = (e: React.DragEvent, groupId: string) => {
    dragOverGroup.current = groupId;
    e.currentTarget.classList.add('drag-over-group');
  };
  
  const handleDragLeaveGroup = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over-group');
  };

  const handleDrop = () => {
    if (!dragItem.current || !dragOverGroup.current || dragItem.current.fromGroupId === dragOverGroup.current) {
        cleanupDragClasses();
        return;
    }
    const { fromGroupId, item } = dragItem.current;
    const toGroupId = dragOverGroup.current;
    
    setGroups(prev => {
        const newGroups = [...prev];
        const fromGroup = newGroups.find(g => g.id === fromGroupId);
        const toGroup = newGroups.find(g => g.id === toGroupId);
        if (fromGroup && toGroup) {
            fromGroup.favorites = fromGroup.favorites.filter(f => f.id !== item.id);
            toGroup.favorites.push(item);
        }
        return newGroups;
    });
    cleanupDragClasses();
  };
  
  const handleDragEnd = () => {
     cleanupDragClasses();
  };

  const cleanupDragClasses = () => {
    dragItem.current = null;
    dragOverGroup.current = null;
    document.querySelectorAll('.drag-over-group, .dragging').forEach(el => 
        el.classList.remove('drag-over-group', 'dragging')
    );
  }
  
  const planetPositions = useMemo(() => {
    const positions: { [key: string]: { x: number, y: number } } = {};
    groups.forEach(group => {
        const count = group.favorites.length;
        group.favorites.forEach((fav, i) => {
            const angle = (i / count) * 2 * Math.PI;
            positions[fav.id] = {
                x: group.x + ORBIT_RADIUS * Math.cos(angle),
                y: group.y + ORBIT_RADIUS * Math.sin(angle),
            };
        });
    });
    return positions;
  }, [groups]);

  return (
    <div id="root-container" ref={rootRef} onWheel={handleWheel} onMouseDown={handleMouseDown}>
      <header>
        <h1>Visual Favorites</h1>
        <button className="btn" onClick={handleAddGroup}>Add Group</button>
      </header>

      <div className="world" style={{ transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})` }}>
        <svg className="connections-svg" style={{ transform: `scale(${1/view.zoom})`}}>
            <g style={{ transform: `translate(${-view.pan.x}px, ${-view.pan.y}px) scale(${view.zoom})` }}>
              {groups.map(group => 
                group.favorites.map(fav => (
                  <line key={`${group.id}-${fav.id}`} x1={group.x} y1={group.y} x2={planetPositions[fav.id]?.x} y2={planetPositions[fav.id]?.y} className="connection-line" />
                ))
              )}
            </g>
        </svg>

        {groups.map((group, groupIdx) => (
          <React.Fragment key={group.id}>
            <div
              className="group"
              style={{ left: group.x, top: group.y }}
              onDragEnter={(e) => handleDragEnterGroup(e, group.id)}
              onDragLeave={handleDragLeaveGroup}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="group-sun">
                <h2 onMouseDown={(e) => handleGroupMouseDown(e, groupIdx)}>{group.name}</h2>
                <button className="btn-add-fav" onClick={() => handleOpenModal(group.id)}>+</button>
              </div>
            </div>
            {group.favorites.map((fav) => (
              <a
                key={fav.id}
                href={fav.url}
                className={`favorite-card favorite-card-${fav.type}`}
                style={{
                    left: planetPositions[fav.id]?.x,
                    top: planetPositions[fav.id]?.y
                }}
                onClick={(e) => handleFavoriteClick(e, fav)}
                draggable
                onDragStart={(e) => handleDragStart(e, group, fav)}
                onDragEnd={handleDragEnd}
              >
                <img src={fav.imageUrl} alt={fav.name} className="thumbnail" />
                <p>{fav.name}</p>
              </a>
            ))}
          </React.Fragment>
        ))}
      </div>
      
      {isModalOpen && <AddFavoriteModal onClose={() => setIsModalOpen(false)} onAdd={handleAddFavorite} />}
      {iframeUrl && <IframeModal url={iframeUrl} onClose={() => setIframeUrl(null)} />}
    </div>
  );
};

// --- MODAL COMPONENTS ---
interface AddFavoriteModalProps { onClose: () => void; onAdd: (favorite: Omit<Favorite, 'id'>) => void; }
const AddFavoriteModal: React.FC<AddFavoriteModalProps> = ({ onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<'web' | 'teams'>('web');
  const [image, setImage] = useState<string | null>(null);
  const [openBehavior, setOpenBehavior] = useState<'modal' | 'newTab'>('newTab');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target?.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && url && image) {
      onAdd({ name, url, type, imageUrl: image, openBehavior: type === 'web' ? openBehavior : undefined });
    } else {
      alert("Please fill all fields and upload an image.");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Add New Favorite</h3>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group"><label htmlFor="name">Name</label><input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="form-group"><label htmlFor="url">URL</label><input id="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} required /></div>
          <div className="form-group"><label htmlFor="type">Type</label><select id="type" value={type} onChange={(e) => setType(e.target.value as 'web' | 'teams')}><option value="web">Web Page</option><option value="teams">Teams Link</option></select></div>
          {type === 'web' && (
             <div className="form-group radio-group">
                <label>Open in:</label>
                <label><input type="radio" value="newTab" checked={openBehavior === 'newTab'} onChange={(e) => setOpenBehavior(e.target.value as 'newTab')} /> New Tab</label>
                <label><input type="radio" value="modal" checked={openBehavior === 'modal'} onChange={(e) => setOpenBehavior(e.target.value as 'modal')} /> Modal</label>
            </div>
          )}
          <div className="form-group"><label htmlFor="image">Image (Planet or Photo)</label><input id="image" type="file" accept="image/*" onChange={handleImageChange} required /></div>
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn">Add</button></div>
        </form>
      </div>
    </div>
  );
};

const IframeModal: React.FC<{url: string, onClose: () => void}> = ({ url, onClose }) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="iframe-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="btn-close-iframe" onClick={onClose}>&times;</button>
                <iframe src={url} title="Embedded Content" allowFullScreen></iframe>
            </div>
        </div>
    )
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
