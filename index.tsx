import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// --- CONSTANTS ---
const ORBIT_RADIUS = 180;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3.0;

// --- DATA TYPES ---
interface Favorite {
  id: string;
  type: 'web' | 'teams' | 'excel' | 'powerpoint' | 'teamsGroup';
  name: string;
  url: string;
  imageUrl?: string;
  displayText?: string;
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

interface TravelingItem {
  item: Favorite;
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  fromGroupId: string;
  toGroupId: string;
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
        { id: 'fav-1', type: 'web', name: 'Company Portal', url: 'https://www.google.com/search?q=santander', displayText: 'Portal', openBehavior: 'modal' },
        { id: 'fav-2', type: 'web', name: 'Project Tracker', url: '#', imageUrl: 'https://placehold.co/100x100/333333/FFFFFF/png?text=Tracker', openBehavior: 'newTab' },
        { id: 'fav-5', type: 'excel', name: 'Q3 Report', url: '#', imageUrl: 'https://placehold.co/100x100/107C41/FFFFFF/png?text=XLS' },
        { id: 'fav-6', type: 'powerpoint', name: 'Deck', url: '#', displayText: 'PPT' },
      ],
    },
    {
      id: 'group-2', name: "Team Contacts", x: 800, y: 500,
      favorites: [
        { id: 'fav-3', type: 'teams', name: 'Alice Johnson', url: '#', imageUrl: 'https://i.pravatar.cc/150?u=alice' },
        { id: 'fav-4', type: 'teams', name: 'Bob Williams', url: '#', imageUrl: 'https://i.pravatar.cc/150?u=bob' },
        { id: 'fav-7', type: 'teamsGroup', name: 'Project Alpha', url: '#', displayText: 'PA' },
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
  const [editingFavorite, setEditingFavorite] = useState<Favorite | null>(null);
  const [view, setView] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [travelingItem, setTravelingItem] = useState<TravelingItem | null>(null);
  const [clickedFavoriteId, setClickedFavoriteId] = useState<string | null>(null);
  const [newlyAddedFavId, setNewlyAddedFavId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const rootRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const interactionState = useRef({
    isPanning: false,
    isDraggingGroup: false,
    draggedGroupIndex: -1,
    startPos: { x: 0, y: 0 },
    initialGroupPos: { x: 0, y: 0 },
  });

  const dragItem = useRef<{ fromGroupId: string; item: Favorite } | null>(null);
  const dragOverGroup = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem('visualFavorites', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    if (newlyAddedFavId) {
        const timer = setTimeout(() => setNewlyAddedFavId(null), 700); // Animation duration
        return () => clearTimeout(timer);
    }
  }, [newlyAddedFavId]);

  // --- Search Logic ---
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return null;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    const matchingFavIds = new Set<string>();
    const matchingGroupIds = new Set<string>();

    groups.forEach(group => {
      let groupHasMatch = false;
      group.favorites.forEach(fav => {
        const groupName = group.name.toLowerCase();
        const favName = fav.name.toLowerCase();
        const favUrl = fav.url.toLowerCase();
        const favType = fav.type.toLowerCase();

        if (groupName.includes(lowerCaseQuery) ||
            favName.includes(lowerCaseQuery) ||
            favUrl.includes(lowerCaseQuery) ||
            favType.includes(lowerCaseQuery)) {
          matchingFavIds.add(fav.id);
          groupHasMatch = true;
        }
      });
      if(groupHasMatch) {
          matchingGroupIds.add(group.id);
      }
    });
    return { matchingFavIds, matchingGroupIds };
  }, [searchQuery, groups]);


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

  const handleAddGroup = () => {
    const newGroupName = prompt("Enter new group name:");
    if (newGroupName) {
      setGroups(prev => [...prev, { id: `group-${Date.now()}`, name: newGroupName, favorites: [], x: 200, y: 200 }]);
    }
  };

  const openAddModal = (groupId: string) => {
    setActiveGroupId(groupId);
    setEditingFavorite(null);
    setIsModalOpen(true);
  };
  
  const openEditModal = (favorite: Favorite) => {
    setEditingFavorite(favorite);
    setIsModalOpen(true);
  }

  const handleSaveFavorite = (favoriteData: Favorite | Omit<Favorite, 'id'>) => {
    if ('id' in favoriteData) {
      const updatedFavorite = favoriteData as Favorite;
      setGroups(prevGroups => 
        prevGroups.map(group => ({
          ...group,
          favorites: group.favorites.map(fav => fav.id === updatedFavorite.id ? updatedFavorite : fav)
        }))
      );
    } else {
      if (!activeGroupId) return;
      const newFavorite = { ...favoriteData, id: `fav-${Date.now()}` };
      setGroups(prev =>
        prev.map(group =>
          group.id === activeGroupId ? { ...group, favorites: [...group.favorites, newFavorite] } : group
        )
      );
      setNewlyAddedFavId(newFavorite.id);
    }
    closeModal();
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingFavorite(null);
    setActiveGroupId(null);
  }

  const handleFavoriteClick = (e: React.MouseEvent, fav: Favorite) => {
      e.preventDefault();
      if (fav.type === 'web' && fav.openBehavior === 'modal') {
          setIframeUrl(fav.url);
      } else {
          setClickedFavoriteId(fav.id);
          setTimeout(() => {
            window.open(fav.url, '_blank', 'noopener,noreferrer');
            setClickedFavoriteId(null);
          }, 500);
      }
  };

  const handleExport = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(groups, null, 2))}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "visual-favorites-backup.json";
    link.click();
  };

  const handleImportClick = () => {
    importFileRef.current?.click();
  };
  
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        const importedGroups = JSON.parse(text as string);
        if (Array.isArray(importedGroups) && importedGroups.every(g => 'id' in g && 'name' in g && 'favorites' in g)) {
           if(window.confirm("This will overwrite your current layout. Are you sure?")) {
              setGroups(importedGroups);
           }
        } else {
          alert("Invalid file format.");
        }
      } catch (error) {
        alert("Error reading or parsing the file.");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };
  
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

  // --- DRAG AND DROP FAVORITES ---
  const handleDragStart = (e: React.DragEvent, fromGroup: Group, item: Favorite) => {
    dragItem.current = { fromGroupId: fromGroup.id, item };
    setTimeout(() => { (e.target as HTMLElement).classList.add('dragging'); }, 0);
  };

  const handleDragEnterGroup = (e: React.DragEvent, groupId: string) => {
    dragOverGroup.current = groupId;
    (e.currentTarget as HTMLElement).classList.add('drag-over-group');
  };
  
  const handleDragLeaveGroup = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('drag-over-group');
  };

  const handleDrop = () => {
    if (!dragItem.current || !dragOverGroup.current || dragItem.current.fromGroupId === dragOverGroup.current) {
        cleanupDragClasses();
        return;
    }
    const { fromGroupId, item } = dragItem.current;
    const toGroupId = dragOverGroup.current;

    const startPos = planetPositions[item.id];
    
    // Temporarily add item to destination to calculate new position
    const toGroup = groups.find(g => g.id === toGroupId)!;
    const tempToGroupFavorites = [...toGroup.favorites, item];
    const newIndex = tempToGroupFavorites.length -1;
    const newCount = tempToGroupFavorites.length;
    const angle = (newIndex / newCount) * 2 * Math.PI;
    const endPos = { 
        x: toGroup.x + ORBIT_RADIUS * Math.cos(angle), 
        y: toGroup.y + ORBIT_RADIUS * Math.sin(angle) 
    };
    
    if (startPos && endPos) {
      setTravelingItem({ item, startPos, endPos, fromGroupId, toGroupId });
    }
    cleanupDragClasses();
  };

  const handleTravelEnd = () => {
    if (!travelingItem) return;
    const { item, fromGroupId, toGroupId } = travelingItem;
    setGroups(prev =>
      prev.map(group => {
        if (group.id === fromGroupId) {
          return { ...group, favorites: group.favorites.filter(f => f.id !== item.id) };
        }
        if (group.id === toGroupId) {
          return { ...group, favorites: [...group.favorites, item] };
        }
        return group;
      })
    );
    setTravelingItem(null);
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

  return (
    <div id="root-container" ref={rootRef} onWheel={handleWheel} onMouseDown={handleMouseDown}>
      <header>
        <h1>Visual Favorites</h1>
        <div className="search-container">
            <input
                type="text"
                placeholder="Search title, url, group, type..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
                <button className="search-clear-btn" onClick={() => setSearchQuery('')}>&times;</button>
            )}
        </div>
        <div className="header-actions">
           <input type="file" ref={importFileRef} style={{ display: 'none' }} onChange={handleImport} accept=".json" />
           <button className="btn icon-btn" onClick={handleImportClick} title="Import JSON">📥</button>
           <button className="btn icon-btn" onClick={handleExport} title="Export JSON">📤</button>
           <button className="btn" onClick={handleAddGroup}>Add Group</button>
        </div>
      </header>

      <div className="world" style={{ transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})` }}>
        <svg className="connections-svg" style={{ transform: `scale(${1/view.zoom})` }}>
            <g style={{ transform: `scale(${view.zoom})` }}>
              {groups.map(group => 
                group.favorites.map(fav => {
                  if (travelingItem?.item.id === fav.id) return null;
                  const pos = planetPositions[fav.id];
                  if (!pos) return null;
                  const isDimmed = searchResults && !searchResults.matchingFavIds.has(fav.id);
                  return <line key={`${group.id}-${fav.id}`} x1={group.x} y1={group.y} x2={pos.x} y2={pos.y} className={`connection-line ${isDimmed ? 'is-dimmed' : ''}`} />
                })
              )}
            </g>
        </svg>

        {groups.map((group, groupIdx) => {
            const isGroupDimmed = searchResults && !searchResults.matchingGroupIds.has(group.id);
            return (
          <React.Fragment key={group.id}>
            <div
              className={`group ${isGroupDimmed ? 'is-dimmed' : ''}`}
              style={{ left: group.x, top: group.y }}
              onDragEnter={(e) => handleDragEnterGroup(e, group.id)}
              onDragLeave={handleDragLeaveGroup}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="group-sun">
                <h2 onMouseDown={(e) => handleGroupMouseDown(e, groupIdx)}>{group.name}</h2>
                <button className="btn-add-fav" onClick={() => openAddModal(group.id)}>+</button>
              </div>
            </div>
            {group.favorites.map((fav) => {
              const pos = planetPositions[fav.id];
              if (!pos) return null;
              
              const isTravelingOriginal = travelingItem?.item.id === fav.id;
              const isSpawning = newlyAddedFavId === fav.id;
              const isClicked = clickedFavoriteId === fav.id;
              const isMatch = !!searchResults?.matchingFavIds.has(fav.id);
              const isDimmed = searchResults && !isMatch;

              return (
              <a
                key={fav.id}
                href={fav.url}
                className={`
                  favorite-card 
                  favorite-card-${fav.type} 
                  ${isClicked ? 'clicked-effect' : ''}
                  ${isTravelingOriginal ? 'is-traveling-original' : ''}
                  ${isSpawning ? 'is-spawning' : ''}
                  ${isDimmed ? 'is-dimmed' : ''}
                  ${isMatch ? 'is-highlighted' : ''}
                `}
                style={{ left: pos.x, top: pos.y }}
                onClick={(e) => handleFavoriteClick(e, fav)}
                draggable
                onDragStart={(e) => handleDragStart(e, group, fav)}
                onDragEnd={handleDragEnd}
              >
                <div className="favorite-content">
                    {fav.imageUrl ? (
                        <img src={fav.imageUrl} alt={fav.name} className="thumbnail" />
                    ) : (
                        <div className="thumbnail text-thumbnail">
                            <span>{fav.displayText}</span>
                        </div>
                    )}
                    <p>{fav.name}</p>
                    <button className="btn-edit-fav" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditModal(fav); }}>✏️</button>
                </div>
              </a>
            )})}
          </React.Fragment>
        )})}
        {travelingItem && <TravelingFavorite {...travelingItem} onAnimationEnd={handleTravelEnd} />}
      </div>
      
      {isModalOpen && <AddFavoriteModal onClose={closeModal} onSave={handleSaveFavorite} favoriteToEdit={editingFavorite} />}
      {iframeUrl && <IframeModal url={iframeUrl} onClose={() => setIframeUrl(null)} />}
    </div>
  );
};

// --- HELPER & MODAL COMPONENTS ---

const TravelingFavorite: React.FC<TravelingItem & { onAnimationEnd: () => void; }> = ({ item, startPos, endPos, onAnimationEnd }) => {
  const [style, setStyle] = useState<React.CSSProperties>({
    left: startPos.x,
    top: startPos.y,
    transform: 'translate(-50%, -50%) scale(1.1)', // Start slightly bigger
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setStyle({
        left: endPos.x,
        top: endPos.y,
        transform: 'translate(-50%, -50%) scale(1)',
      });
    }, 20);
    return () => clearTimeout(timer);
  }, [endPos]);

  const handleTransitionEnd = (e: React.TransitionEvent) => {
    // onTransitionEnd can fire for multiple properties. We only want to trigger the logic once.
    if (e.propertyName === 'left') {
      onAnimationEnd();
    }
  };

  return (
    <div
      className={`favorite-card favorite-card-${item.type} traveling-favorite`}
      style={style}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="favorite-content">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="thumbnail" />
        ) : (
          <div className="thumbnail text-thumbnail">
            <span>{item.displayText}</span>
          </div>
        )}
        <p>{item.name}</p>
      </div>
    </div>
  );
};

const AddFavoriteModal: React.FC<{ 
  onClose: () => void; 
  onSave: (favorite: Favorite | Omit<Favorite, 'id'>) => void;
  favoriteToEdit: Favorite | null;
}> = ({ onClose, onSave, favoriteToEdit }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<Favorite['type']>('web');
  const [inputType, setInputType] = useState<'image' | 'text'>('image');
  const [image, setImage] = useState<string | null>(null);
  const [displayText, setDisplayText] = useState('');
  const [openBehavior, setOpenBehavior] = useState<'modal' | 'newTab'>('newTab');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsOpen(true), 10);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    if (favoriteToEdit) {
      setName(favoriteToEdit.name);
      setUrl(favoriteToEdit.url);
      setType(favoriteToEdit.type);
      setOpenBehavior(favoriteToEdit.openBehavior || 'newTab');
      if (favoriteToEdit.imageUrl) {
        setInputType('image');
        setImage(favoriteToEdit.imageUrl);
        setDisplayText('');
      } else {
        setInputType('text');
        setDisplayText(favoriteToEdit.displayText || '');
        setImage(null);
      }
    } else {
      setName(''); setUrl(''); setType('web'); setImage(null); setOpenBehavior('newTab'); setInputType('image'); setDisplayText('');
    }
  }, [favoriteToEdit]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 400);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target?.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isTextValid = inputType === 'text' && displayText.trim();
    const isImageValid = inputType === 'image' && image;
    if (name && url && (isTextValid || isImageValid)) {
      const commonData = { name, url, type, openBehavior: type === 'web' ? openBehavior : undefined };
      const contentData = inputType === 'text' ? { displayText, imageUrl: undefined } : { imageUrl: image!, displayText: undefined };
      if (favoriteToEdit) {
        onSave({ ...commonData, ...contentData, id: favoriteToEdit.id });
      } else {
        onSave({ ...commonData, ...contentData });
      }
    } else {
      alert("Please fill all fields and provide an image or text.");
    }
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`} onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{favoriteToEdit ? 'Edit Favorite' : 'Add New Favorite'}</h3>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group"><label>Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="form-group"><label>URL</label><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required /></div>
          <div className="form-group"><label>Type</label><select value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="web">Web Page</option><option value="teams">Teams Contact</option><option value="excel">Excel</option>
              <option value="powerpoint">PowerPoint</option><option value="teamsGroup">Teams Group</option>
          </select></div>
          {type === 'web' && (
             <div className="form-group radio-group"><label>Open in:</label>
                <label><input type="radio" value="newTab" checked={openBehavior === 'newTab'} onChange={(e) => setOpenBehavior(e.target.value as 'newTab')} /> New Tab</label>
                <label><input type="radio" value="modal" checked={openBehavior === 'modal'} onChange={(e) => setOpenBehavior(e.target.value as 'modal')} /> Modal</label>
            </div>
          )}
          <div className="form-group radio-group"><label>Display:</label>
            <label><input type="radio" name="inputType" value="image" checked={inputType === 'image'} onChange={() => setInputType('image')} /> Image</label>
            <label><input type="radio" name="inputType" value="text" checked={inputType === 'text'} onChange={() => setInputType('text')} /> Text</label>
          </div>
          {inputType === 'image' ? (
            <div className="form-group"><label>Image Upload</label><input type="file" accept="image/*" onChange={handleImageChange} />
             {image && <img src={image} alt="Preview" style={{maxWidth: '100px', alignSelf: 'center', margin: '10px 0'}}/>}
            </div>
          ) : (
            <div className="form-group"><label>Display Text (1-4 Chars)</label><input type="text" value={displayText} onChange={(e) => setDisplayText(e.target.value)} maxLength={4} required /></div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancel</button>
            <button type="submit" className="btn">{favoriteToEdit ? 'Save Changes' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const IframeModal: React.FC<{url: string, onClose: () => void}> = ({ url, onClose }) => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
      const timer = setTimeout(() => setIsOpen(true), 10);
      return () => clearTimeout(timer);
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        setTimeout(onClose, 400); // Wait for closing animation
    };

    return (
        <div className={`modal-overlay ${isOpen ? 'open' : ''}`} onClick={handleClose}>
            <div className="iframe-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="btn-close-iframe" onClick={handleClose}>&times;</button>
                <iframe src={url} title="Embedded Content" allowFullScreen></iframe>
            </div>
        </div>
    );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}