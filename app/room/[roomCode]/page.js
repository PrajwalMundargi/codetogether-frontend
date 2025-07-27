'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import XTerminal from '../../Components/XTerminal';

// File Tree Component for hierarchical display
function FileTree({ files, activeFile, onFileSelect, onRightClick, onFolderToggle, onItemMove, isRenaming, renameValue, setRenameValue, onRenameConfirm, onRenameCancel, isSocketConnected, isRoomJoined }) {
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOver, setDragOver] = useState(null);

    const buildFileTree = (files) => {
        const tree = {};
        const items = Object.keys(files).sort();
        
        items.forEach(itemPath => {
            const parts = itemPath.split('/');
            let current = tree;
            
            parts.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = {
                        type: index === parts.length - 1 ? files[itemPath].type : 'folder',
                        path: parts.slice(0, index + 1).join('/'),
                        children: {},
                        data: files[itemPath],
                        isExpanded: files[parts.slice(0, index + 1).join('/')]?.isExpanded || false
                    };
                }
                current = current[part].children;
            });
        });
        
        return tree;
    };

    const handleDragStart = (e, itemPath, itemType) => {
        e.dataTransfer.effectAllowed = 'move';
        setDraggedItem({ path: itemPath, type: itemType });
    };

    const handleDragOver = (e, targetPath, targetType) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (targetType === 'folder') {
            setDragOver(targetPath);
        }
    };

    const handleDragLeave = (e) => {
        // Only clear dragOver if we're really leaving the element
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
            setDragOver(null);
        }
    };

    const handleDrop = (e, targetPath, targetType) => {
        e.preventDefault();
        setDragOver(null);
        
        if (!draggedItem || draggedItem.path === targetPath) {
            setDraggedItem(null);
            return;
        }
        
        if (targetType === 'folder') {
            const sourceName = draggedItem.path.split('/').pop();
            const newPath = targetPath ? `${targetPath}/${sourceName}` : sourceName;
            
            // Prevent moving a folder into itself
            if (draggedItem.type === 'folder' && targetPath.startsWith(draggedItem.path)) {
                alert('Cannot move a folder into itself');
                setDraggedItem(null);
                return;
            }
            
            onItemMove(draggedItem.path, newPath, draggedItem.type);
        }
        
        setDraggedItem(null);
    };

    const renderTreeItem = (name, item, level = 0) => {
        const isFolder = item.type === 'folder';
        const isActive = activeFile === item.path;
        const isBeingRenamed = isRenaming === item.path;
        const isDraggedOver = dragOver === item.path && draggedItem && draggedItem.path !== item.path;
        
        return (
            <div key={item.path}>
                <div
                    className={`flex items-center py-1 px-2 hover:bg-gray-700 cursor-pointer ${
                        isActive ? 'bg-blue-600' : ''
                    } ${isDraggedOver ? 'bg-green-600' : ''}`}
                    style={{ paddingLeft: `${level * 16 + 8}px` }}
                    draggable={isSocketConnected && isRoomJoined && !isBeingRenamed}
                    onDragStart={(e) => handleDragStart(e, item.path, item.type)}
                    onDragOver={(e) => handleDragOver(e, item.path, item.type)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, item.path, item.type)}
                    onClick={() => {
                        if (isFolder) {
                            onFolderToggle(item.path);
                        } else {
                            onFileSelect(item.path);
                        }
                    }}
                    onContextMenu={(e) => onRightClick(e, item.path, item.type)}
                >
                    {isBeingRenamed ? (
                        <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') onRenameConfirm(item.path, renameValue);
                                if (e.key === 'Escape') onRenameCancel();
                            }}
                            onBlur={() => onRenameConfirm(item.path, renameValue)}
                            className='flex-1 px-1 bg-gray-700 border border-gray-600 rounded text-sm'
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <>
                            <span className='mr-2 text-sm'>
                                {isFolder ? (item.isExpanded ? '📂' : '📁') : getFileIcon(name)}
                            </span>
                            <span className='text-sm truncate flex-1'>{name}</span>
                            {isActive && !isFolder && (
                                <span className='ml-1 text-xs text-blue-300'>●</span>
                            )}
                            {draggedItem && draggedItem.path === item.path && (
                                <span className='ml-1 text-xs text-yellow-300'>↗</span>
                            )}
                        </>
                    )}
                </div>
                
                {isFolder && item.isExpanded && (
                    <div>
                        {Object.keys(item.children).sort().map(childName => 
                            renderTreeItem(childName, item.children[childName], level + 1)
                        )}
                    </div>
                )}
            </div>
        );
    };

    const tree = buildFileTree(files);
    
    return (
        <div 
            className="flex-1 overflow-y-auto"
            onDragOver={(e) => {
                e.preventDefault();
                if (draggedItem) {
                    setDragOver(''); // Root level
                }
            }}
            onDrop={(e) => handleDrop(e, '', 'folder')}
        >
            {Object.keys(tree).length === 0 ? (
                <div className='p-3 text-gray-400 text-sm'>
                    {isRoomJoined ? 'No files found. Create a new file to get started.' : 'Connecting to room...'}
                </div>
            ) : (
                Object.keys(tree).sort().map(name => 
                    renderTreeItem(name, tree[name], 0)
                )
            )}
        </div>
    );
}

function CollaborativeIDE() {
    const [code, setCode] = useState('// Loading...');
    const [socket, setSocket] = useState(null);
    const [files, setFiles] = useState({});
    const [activeFile, setActiveFile] = useState(null);
    const [showFileExplorer, setShowFileExplorer] = useState(true);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, itemPath: null, itemType: null });
    const [newItemName, setNewItemName] = useState('');
    const [isCreatingFile, setIsCreatingFile] = useState(false);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [createInFolder, setCreateInFolder] = useState('');
    const [isRenaming, setIsRenaming] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [workingDirectory, setWorkingDirectory] = useState('');
    const [isSocketConnected, setIsSocketConnected] = useState(false);
    const [isRoomJoined, setIsRoomJoined] = useState(false);
    const [connectedUsers, setConnectedUsers] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('Checking authentication...');
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    
    // Authentication states
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authData, setAuthData] = useState(null);
    const [isAuthChecking, setIsAuthChecking] = useState(true);

    const params = useParams();
    const router = useRouter();
    const roomCode = params.roomCode;

    const isUpdatingFromServer = useRef(false);
    const codeUpdateTimeoutRef = useRef(null);
    const socketRef = useRef(null);

    // Authentication check
    useEffect(() => {
        const checkAuthentication = () => {
            console.log('Checking room authentication...');
            
            try {
                const authString = sessionStorage.getItem('roomAuth');
                if (!authString) {
                    console.log('No authentication data found');
                    setConnectionStatus('Authentication required');
                    setTimeout(() => {
                        router.push('/');
                    }, 2000);
                    return;
                }

                const parsedAuth = JSON.parse(authString);
                console.log('Found auth data:', parsedAuth);

                if (!parsedAuth.isAuthenticated || 
                    !parsedAuth.username || 
                    !parsedAuth.roomCode || 
                    !parsedAuth.password ||
                    parsedAuth.roomCode !== roomCode) {
                    console.log('Invalid or mismatched authentication data');
                    setConnectionStatus('Authentication mismatch');
                    setTimeout(() => {
                        router.push('/');
                    }, 2000);
                    return;
                }

                setAuthData(parsedAuth);
                setIsAuthenticated(true);
                setConnectionStatus('Authentication verified');
                console.log('Authentication successful for user:', parsedAuth.username);
                
            } catch (error) {
                console.error('Error checking authentication:', error);
                setConnectionStatus('Authentication error');
                setTimeout(() => {
                    router.push('/');
                }, 2000);
            } finally {
                setIsAuthChecking(false);
            }
        };

        if (roomCode) {
            checkAuthentication();
        } else {
            setIsAuthChecking(false);
            setConnectionStatus('Invalid room code');
            setTimeout(() => {
                router.push('/');
            }, 2000);
        }
    }, [roomCode, router]);

    // Socket connection
    useEffect(() => {
        if (!isAuthenticated || !authData || !roomCode) {
            console.log('Skipping socket connection - not authenticated');
            return;
        }

        const connectSocket = () => {
            console.log('Attempting to connect to socket server...');
            setConnectionStatus('Connecting to server...');

            const newSocket = io('https://codetogether-backend-tr5r.onrender.com', {
                transports: ['websocket', 'polling'],
                timeout: 20000,
                forceNew: true,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });

            newSocket.on('connect', () => {
                console.log('Socket connected successfully:', newSocket.id);
                setIsSocketConnected(true);
                setConnectionStatus('Server connected');
                setReconnectAttempts(0);
            });

            newSocket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
                setIsSocketConnected(false);
                setIsRoomJoined(false);
                setConnectionStatus('Server connection failed');
            });

            newSocket.on('disconnect', (reason) => {
                console.log('Socket disconnected:', reason);
                setIsSocketConnected(false);
                setIsRoomJoined(false);
                setConnectionStatus('Server disconnected');
            });

            newSocket.on('reconnect', (attemptNumber) => {
                console.log('Reconnected after', attemptNumber, 'attempts');
                setReconnectAttempts(0);
            });

            newSocket.on('reconnect_attempt', (attemptNumber) => {
                console.log('Reconnection attempt:', attemptNumber);
                setReconnectAttempts(attemptNumber);
                setConnectionStatus(`Reconnecting... (${attemptNumber})`);
            });

            socketRef.current = newSocket;
            setSocket(newSocket);
        };

        connectSocket();

        return () => {
            if (socketRef.current) {
                console.log('Cleaning up socket connection');
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [isAuthenticated, authData, roomCode]);

    // Room joining logic
    const attemptJoinRoom = useCallback(() => {
        if (!socket || !roomCode || !isSocketConnected || isRoomJoined || !authData) {
            console.log('Cannot join room: missing requirements', { 
                socket: !!socket, 
                roomCode, 
                isSocketConnected, 
                isRoomJoined,
                authData: !!authData
            });
            return;
        }

        console.log('Attempting to join room:', roomCode, 'as user:', authData.username);
        setConnectionStatus('Joining room...');
        
        socket.emit('join-room', { 
            username: authData.username, 
            roomCode: roomCode, 
            password: authData.password
        }, (response) => {
            console.log('Join room response:', response);
            
            if (response && response.success) {
                console.log('Successfully joined room');
                setIsRoomJoined(true);
                setConnectionStatus(`Connected to room ${roomCode}`);
                
                if (response.files) {
                    console.log('Setting initial files:', response.files);
                    setFiles(response.files);
                    
                    const fileNames = Object.keys(response.files).filter(key => 
                        response.files[key].type === 'file'
                    );
                    if (fileNames.length > 0) {
                        const firstFile = response.activeFile || fileNames[0];
                        setActiveFile(firstFile);
                        setCode(response.files[firstFile]?.content || '// Start coding...');
                        console.log('Set active file:', firstFile);
                    }
                }
                
                setTimeout(() => {
                    if (socket && isRoomJoined) {
                        socket.emit('get-files', { roomCode }, (response) => {
                            console.log('Files received after join:', response);
                            if (response && response.files) {
                                setFiles(response.files);
                                
                                const fileNames = Object.keys(response.files).filter(key => 
                                    response.files[key].type === 'file'
                                );
                                if (fileNames.length > 0 && !activeFile) {
                                    const firstFile = fileNames[0];
                                    setActiveFile(firstFile);
                                    setCode(response.files[firstFile]?.content || '// Start coding...');
                                }
                            }
                        });
                        
                        socket.emit('get-working-directory', { roomCode }, (response) => {
                            if (response && response.workingDirectory) {
                                setWorkingDirectory(response.workingDirectory);
                            }
                        });
                        
                        socket.emit('terminal-init', { roomCode });
                    }
                }, 1000);
                
            } else {
                console.error('Failed to join room:', response?.error);
                setConnectionStatus(`Join failed: ${response?.error || 'Unknown error'}`);
                
                if (response?.error?.includes('password') || response?.error?.includes('not found')) {
                    setTimeout(() => {
                        sessionStorage.removeItem('roomAuth');
                        router.push('/');
                    }, 3000);
                }
            }
        });
    }, [socket, roomCode, isSocketConnected, isRoomJoined, authData, activeFile, router]);

    // Handle room joining
    useEffect(() => {
        if (!socket || !roomCode || !isSocketConnected || isRoomJoined || !authData) {
            return;
        }

        const joinDelay = setTimeout(() => {
            attemptJoinRoom();
        }, 500);

        return () => clearTimeout(joinDelay);
    }, [socket, roomCode, isSocketConnected, isRoomJoined, authData, attemptJoinRoom]);

    // Socket event handlers
    useEffect(() => {
        if (!socket || !isRoomJoined) {
            return;
        }

        const handleCodeUpdate = ({ code: newCode, fileName, fromUser }) => {
            try {
                console.log('Received code update for file:', fileName, 'from user:', fromUser);
                
                if (fileName === activeFile && fromUser !== socket.id) {
                    isUpdatingFromServer.current = true;
                    setCode(newCode);
                    
                    setTimeout(() => {
                        isUpdatingFromServer.current = false;
                    }, 100);
                }
            } catch (error) {
                console.error('Error handling code update:', error);
            }
        };

        const handleFilesUpdate = (updatedFiles) => {
            try {
                console.log('Received files update:', Object.keys(updatedFiles));
                setFiles(updatedFiles);
                
                if (!activeFile) {
                    const fileNames = Object.keys(updatedFiles).filter(key => 
                        updatedFiles[key].type === 'file'
                    );
                    if (fileNames.length > 0) {
                        const firstFile = fileNames[0];
                        setActiveFile(firstFile);
                        setCode(updatedFiles[firstFile]?.content || '// Start coding...');
                    }
                }
                
                if (activeFile && !updatedFiles[activeFile]) {
                    const fileNames = Object.keys(updatedFiles).filter(key => 
                        updatedFiles[key].type === 'file'
                    );
                    if (fileNames.length > 0) {
                        const newActiveFile = fileNames[0];
                        setActiveFile(newActiveFile);
                        setCode(updatedFiles[newActiveFile]?.content || '');
                    }
                }
            } catch (error) {
                console.error('Error handling files update:', error);
            }
        };

        const handleFileContentUpdate = ({ fileName, content }) => {
            try {
                console.log('File content updated:', fileName);
                if (fileName === activeFile && !isUpdatingFromServer.current) {
                    isUpdatingFromServer.current = true;
                    setCode(content);
                    setTimeout(() => {
                        isUpdatingFromServer.current = false;
                    }, 100);
                }
            } catch (error) {
                console.error('Error handling file content update:', error);
            }
        };

        const handleActiveFileChanged = ({ fileName }) => {
            try {
                console.log('Active file changed to:', fileName);
                setActiveFile(fileName);
            } catch (error) {
                console.error('Error handling active file change:', error);
            }
        };

        const handleFileCreated = ({ fileName }) => {
            console.log('File created:', fileName);
            socket.emit('get-files', { roomCode }, (response) => {
                if (response && response.files) {
                    setFiles(response.files);
                }
            });
        };

        const handleFolderCreated = ({ folderPath }) => {
            console.log('Folder created:', folderPath);
        };

        const handleItemDeleted = ({ itemPath, type }) => {
            console.log(`${type} deleted:`, itemPath);
        };

        const handleItemRenamed = ({ oldPath, newPath, type }) => {
            try {
                console.log(`${type} renamed:`, oldPath, '->', newPath);
                if (activeFile === oldPath) {
                    setActiveFile(newPath);
                }
            } catch (error) {
                console.error('Error handling item rename:', error);
            }
        };

        const handleItemMoved = ({ sourcePath, targetPath, itemType }) => {
            try {
                console.log(`${itemType} moved:`, sourcePath, '->', targetPath);
                if (activeFile === sourcePath) {
                    setActiveFile(targetPath);
                }
            } catch (error) {
                console.error('Error handling item move:', error);
            }
        };

        const handleFolderToggled = ({ folderPath, isExpanded }) => {
            console.log('Folder toggled:', folderPath, 'expanded:', isExpanded);
        };

        const handleFileError = ({ message }) => {
            console.error('File error:', message);
            alert(`Error: ${message}`);
        };

        const handleFileSynced = ({ fileName, content }) => {
            try {
                console.log(`File ${fileName} was synced from terminal`);
                setFiles(prevFiles => ({
                    ...prevFiles,
                    [fileName]: {
                        ...prevFiles[fileName],
                        content: content
                    }
                }));
                
                if (fileName === activeFile && !isUpdatingFromServer.current) {
                    isUpdatingFromServer.current = true;
                    setCode(content);
                    setTimeout(() => {
                        isUpdatingFromServer.current = false;
                    }, 100);
                }
            } catch (error) {
                console.error('Error handling file sync:', error);
            }
        };

        const handleUserJoined = ({ username: joinedUsername, userId }) => {
            try {
                console.log('User joined:', joinedUsername);
                setConnectedUsers(prev => {
                    if (prev.some(user => user.userId === userId)) {
                        return prev;
                    }
                    return [...prev, { username: joinedUsername, userId }];
                });
            } catch (error) {
                console.error('Error handling user joined:', error);
            }
        };

        const handleUserLeft = ({ username: leftUsername, userId }) => {
            try {
                console.log('User left:', leftUsername);
                setConnectedUsers(prev => prev.filter(user => user.userId !== userId));
            } catch (error) {
                console.error('Error handling user left:', error);
            }
        };

        // Register all event listeners
        socket.on('code-update', handleCodeUpdate);
        socket.on('files-update', handleFilesUpdate);
        socket.on('file-content-update', handleFileContentUpdate);
        socket.on('active-file-changed', handleActiveFileChanged);
        socket.on('file-created', handleFileCreated);
        socket.on('folder-created', handleFolderCreated);
        socket.on('item-deleted', handleItemDeleted);
        socket.on('item-renamed', handleItemRenamed);
        socket.on('item-moved', handleItemMoved);
        socket.on('folder-toggled', handleFolderToggled);
        socket.on('file-error', handleFileError);
        socket.on('file-synced', handleFileSynced);
        socket.on('user-joined', handleUserJoined);
        socket.on('user-left', handleUserLeft);

        return () => {
            socket.off('code-update', handleCodeUpdate);
            socket.off('files-update', handleFilesUpdate);
            socket.off('file-content-update', handleFileContentUpdate);
            socket.off('active-file-changed', handleActiveFileChanged);
            socket.off('file-created', handleFileCreated);
            socket.off('folder-created', handleFolderCreated);
            socket.off('item-deleted', handleItemDeleted);
            socket.off('item-renamed', handleItemRenamed);
            socket.off('item-moved', handleItemMoved);
            socket.off('folder-toggled', handleFolderToggled);
            socket.off('file-error', handleFileError);
            socket.off('file-synced', handleFileSynced);
            socket.off('user-joined', handleUserJoined);
            socket.off('user-left', handleUserLeft);
        };
    }, [socket, isRoomJoined, activeFile, roomCode]);

    // Debounced code change handler
    const sendCodeChange = useCallback((newCode, fileName) => {
        if (codeUpdateTimeoutRef.current) {
            clearTimeout(codeUpdateTimeoutRef.current);
        }
        
        codeUpdateTimeoutRef.current = setTimeout(() => {
            if (socket && roomCode && !isUpdatingFromServer.current && isSocketConnected && isRoomJoined) {
                console.log('Sending code change for file:', fileName);
                socket.emit('code-change', { 
                    roomCode, 
                    code: newCode, 
                    fileName: fileName 
                });
            }
        }, 300);
    }, [socket, roomCode, isSocketConnected, isRoomJoined]);

    // Handle editor content changes
    const handleChange = useCallback((value) => {
        if (value !== null && value !== undefined) {
            setCode(value);
            
            if (!isUpdatingFromServer.current && activeFile && isSocketConnected && isRoomJoined) {
                sendCodeChange(value, activeFile);
            }
        }
    }, [activeFile, sendCodeChange, isSocketConnected, isRoomJoined]);

    // Manual refresh button function
    const refreshFiles = useCallback(() => {
        if (socket && roomCode && isRoomJoined && isSocketConnected) {
            console.log('Refreshing files...');
            socket.emit('get-files', { roomCode }, (response) => {
                console.log('Refreshed files received:', response);
                if (response && response.files) {
                    setFiles(response.files);
                }
            });
        }
    }, [socket, roomCode, isRoomJoined, isSocketConnected]);

    // File and folder management functions
    const createFile = useCallback(() => {
        if (!newItemName.trim() || !socket || !roomCode || !isSocketConnected || !isRoomJoined) {
            console.log('Cannot create file: missing requirements');
            return;
        }
        
        console.log('Creating file:', newItemName.trim(), 'in folder:', createInFolder);
        socket.emit('create-file', { 
            roomCode, 
            fileName: newItemName.trim(), 
            parentFolder: createInFolder 
        });
        
        setNewItemName('');
        setIsCreatingFile(false);
        setCreateInFolder('');
    }, [newItemName, socket, roomCode, isSocketConnected, isRoomJoined, createInFolder]);

    const createFolder = useCallback(() => {
        if (!newItemName.trim() || !socket || !roomCode || !isSocketConnected || !isRoomJoined) {
            console.log('Cannot create folder: missing requirements');
            return;
        }
        
        console.log('Creating folder:', newItemName.trim(), 'in parent:', createInFolder);
        socket.emit('create-folder', { 
            roomCode, 
            folderName: newItemName.trim(), 
            parentFolder: createInFolder 
        });
        
        setNewItemName('');
        setIsCreatingFolder(false);
        setCreateInFolder('');
    }, [newItemName, socket, roomCode, isSocketConnected, isRoomJoined, createInFolder]);

    const deleteItem = useCallback((itemPath, itemType) => {
        if (itemType === 'file') {
            const fileCount = Object.keys(files).filter(key => files[key].type === 'file').length;
            if (fileCount <= 1) {
                alert('Cannot delete the last file');
                return;
            }
        }
        
        const itemName = itemPath.split('/').pop();
        if (confirm(`Are you sure you want to delete ${itemType} "${itemName}"?`)) {
            if (socket && roomCode && isSocketConnected && isRoomJoined) {
                console.log('Deleting item:', itemPath);
                socket.emit('delete-item', { roomCode, itemPath });
            }
        }
        setContextMenu({ visible: false, x: 0, y: 0, itemPath: null, itemType: null });
    }, [files, socket, roomCode, isSocketConnected, isRoomJoined]);

    const renameItem = useCallback((oldPath, newName) => {
        if (!newName.trim() || newName === oldPath.split('/').pop()) {
            setIsRenaming(null);
            setRenameValue('');
            return;
        }
        
        const pathParts = oldPath.split('/');
        pathParts[pathParts.length - 1] = newName.trim();
        const newPath = pathParts.join('/');
        
        if (socket && roomCode && isSocketConnected && isRoomJoined) {
            console.log('Renaming item:', oldPath, 'to', newPath);
            socket.emit('rename-item', { roomCode, oldPath, newPath });
        }
        
        setIsRenaming(null);
        setRenameValue('');
    }, [socket, roomCode, isSocketConnected, isRoomJoined]);

    const moveItem = useCallback((sourcePath, targetPath, itemType) => {
        if (socket && roomCode && isSocketConnected && isRoomJoined) {
            console.log('Moving item:', sourcePath, 'to', targetPath);
            socket.emit('move-item', { roomCode, sourcePath, targetPath, itemType });
        }
    }, [socket, roomCode, isSocketConnected, isRoomJoined]);

    const switchFile = useCallback((fileName) => {
        if (socket && roomCode && fileName !== activeFile && files[fileName] && files[fileName].type === 'file' && isSocketConnected && isRoomJoined) {
            console.log('Switching to file:', fileName);
            
            setActiveFile(fileName);
            setCode(files[fileName].content || '// Loading...');
            
            socket.emit('switch-file', { roomCode, fileName });
        }
    }, [socket, roomCode, activeFile, files, isSocketConnected, isRoomJoined]);

    const toggleFolder = useCallback((folderPath) => {
        if (socket && roomCode && isSocketConnected && isRoomJoined) {
            console.log('Toggling folder:', folderPath);
            socket.emit('toggle-folder', { roomCode, folderPath });
        }
    }, [socket, roomCode, isSocketConnected, isRoomJoined]);

    // Context menu handlers
    const handleRightClick = useCallback((e, itemPath, itemType) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            itemPath,
            itemType
        });
    }, []);

    const handleClickOutside = useCallback(() => {
        setContextMenu({ visible: false, x: 0, y: 0, itemPath: null, itemType: null });
    }, []);

    // File extension to language mapping
    const getLanguage = useCallback((fileName) => {
        if (!fileName || typeof fileName !== 'string') {
            return 'javascript';
        }
        const parts = fileName.split('.');
        const extension = parts.length > 1 ? parts.pop().toLowerCase() : '';
        const languageMap = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'py': 'python',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'md': 'markdown',
            'txt': 'plaintext',
            'cpp': 'cpp',
            'c': 'c',
            'java': 'java',
            'go': 'go',
            'rs': 'rust',
            'php': 'php',
            'rb': 'ruby',
            'sh': 'shell',
            'ps1': 'powershell'
        };
        return languageMap[extension] || 'javascript';
    }, []);

    // Connection status indicator
    const getConnectionStatusColor = () => {
        if (isSocketConnected && isRoomJoined) return 'text-green-400';
        if (isSocketConnected) return 'text-yellow-400';
        return 'text-red-400';
    };

    // Logout function
    const handleLogout = useCallback(() => {
        if (confirm('Are you sure you want to leave the room?')) {
            sessionStorage.removeItem('roomAuth');
            if (socket) {
                socket.disconnect();
            }
            router.push('/');
        }
    }, [socket, router]);

    // Show loading screen during authentication check
    if (isAuthChecking) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <div className="text-lg mb-2">Checking authentication...</div>
                    <div className="text-sm text-gray-400">{connectionStatus}</div>
                </div>
            </div>
        );
    }

    // Show error if not authenticated
    if (!isAuthenticated || !authData) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900 text-red-400">
                <div className="text-center">
                    <div className="text-6xl mb-4">🚫</div>
                    <div className="text-lg mb-2">Access Denied</div>
                    <div className="text-sm text-gray-400 mb-4">{connectionStatus}</div>
                    <div className="text-sm text-gray-500">Redirecting to dashboard...</div>
                </div>
            </div>
        );
    }

    if (!roomCode) {
        return (
            <div className="flex items-center justify-center h-screen text-red-500">
                <div className="text-center">
                    <div className="text-2xl mb-4">❌</div>
                    <div>No room code provided</div>
                </div>
            </div>
        );
    }

    return (
        <div className='flex h-screen bg-gray-900' onClick={handleClickOutside}>
            {/* File Explorer */}
            {showFileExplorer && (
                <div className='w-64 bg-gray-800 text-white border-r border-gray-600 flex flex-col'>
                    <div className='p-3 border-b border-gray-600 flex justify-between items-center'>
                        <h3 className='font-semibold'>Explorer</h3>
                        <div className='flex gap-1'>
                            <button
                                onClick={refreshFiles}
                                disabled={!isRoomJoined || !isSocketConnected}
                                className='px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm'
                                title="Refresh files"
                            >
                                🔄
                            </button>
                            <button
                                onClick={() => {
                                    setIsCreatingFile(true);
                                    setCreateInFolder('');
                                }}
                                disabled={!isRoomJoined || !isSocketConnected}
                                className='px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm'
                                title="Create new file"
                            >
                                📄
                            </button>
                            <button
                                onClick={() => {
                                    setIsCreatingFolder(true);
                                    setCreateInFolder('');
                                }}
                                disabled={!isRoomJoined || !isSocketConnected}
                                className='px-2 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded text-sm'
                                title="Create new folder"
                            >
                                📁
                            </button>
                        </div>
                    </div>
                    
                    {/* User Info */}
                    <div className='px-3 py-2 text-xs border-b border-gray-600 bg-gray-750'>
                        <div className="flex justify-between items-center">
                            <span>👤 {authData?.username}</span>
                            <button
                                onClick={handleLogout}
                                className="text-red-400 hover:text-red-300 text-xs"
                                title="Leave room"
                            >
                                🚪
                            </button>
                        </div>
                    </div>
                    
                    {/* Connection Status */}
                    <div className={`px-3 py-2 text-xs border-b border-gray-600 ${getConnectionStatusColor()}`}>
                        🔗 {connectionStatus}
                        {reconnectAttempts > 0 && (
                            <span className="ml-2 text-gray-400">
                                (Attempts: {reconnectAttempts})
                            </span>
                        )}
                    </div>
                    
                    {/* Working Directory Display */}
                    {workingDirectory && (
                        <div className='px-3 py-2 text-xs text-gray-400 border-b border-gray-600'>
                            📁 {workingDirectory}
                        </div>
                    )}
                    
                    {/* Connected Users */}
                    <div className='px-3 py-2 text-xs text-gray-400 border-b border-gray-600'>
                        👥 Users: {isRoomJoined ? connectedUsers.length + 1 : 0}
                        {connectedUsers.length > 0 && (
                            <div className="mt-1">
                                {connectedUsers.map(user => (
                                    <div key={user.userId} className="text-xs">
                                        • {user.username}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* New item input */}
                    {(isCreatingFile || isCreatingFolder) && (
                        <div className='p-2 border-b border-gray-600'>
                            <div className="text-xs text-gray-400 mb-1">
                                Creating {isCreatingFile ? 'file' : 'folder'} in: {createInFolder || 'root'}
                            </div>
                            <input
                                type="text"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (isCreatingFile) createFile();
                                        else createFolder();
                                    }
                                    if (e.key === 'Escape') {
                                        setIsCreatingFile(false);
                                        setIsCreatingFolder(false);
                                        setNewItemName('');
                                        setCreateInFolder('');
                                    }
                                }}
                                onBlur={() => {
                                    if (isCreatingFile) createFile();
                                    else createFolder();
                                }}
                                placeholder={`Enter ${isCreatingFile ? 'file' : 'folder'} name...`}
                                className='w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm'
                                autoFocus
                            />
                        </div>
                    )}
                    
                    {/* File Tree */}
                    <FileTree 
                        files={files}
                        activeFile={activeFile}
                        onFileSelect={switchFile}
                        onRightClick={handleRightClick}
                        onFolderToggle={toggleFolder}
                        onItemMove={moveItem}
                        isRenaming={isRenaming}
                        renameValue={renameValue}
                        setRenameValue={setRenameValue}
                        onRenameConfirm={renameItem}
                        onRenameCancel={() => {
                            setIsRenaming(null);
                            setRenameValue('');
                        }}
                        isSocketConnected={isSocketConnected}
                        isRoomJoined={isRoomJoined}
                    />
                </div>
            )}

            {/* Context Menu */}
            {contextMenu.visible && (
                <div
                    className='fixed bg-gray-800 border border-gray-600 rounded shadow-lg z-50 py-1'
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.itemType === 'folder' && (
                        <>
                            <button
                                className='block w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm'
                                onClick={() => {
                                    setIsCreatingFile(true);
                                    setCreateInFolder(contextMenu.itemPath);
                                    setContextMenu({ visible: false, x: 0, y: 0, itemPath: null, itemType: null });
                                }}
                            >
                                📄 New File
                            </button>
                            <button
                                className='block w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm'
                                onClick={() => {
                                    setIsCreatingFolder(true);
                                    setCreateInFolder(contextMenu.itemPath);
                                    setContextMenu({ visible: false, x: 0, y: 0, itemPath: null, itemType: null });
                                }}
                            >
                                📁 New Folder
                            </button>
                            <hr className="border-gray-600 my-1" />
                        </>
                    )}
                    <button
                        className='block w-full px-4 py-2 text-left text-white hover:bg-gray-700 text-sm'
                        onClick={() => {
                            setIsRenaming(contextMenu.itemPath);
                            setRenameValue(contextMenu.itemPath.split('/').pop());
                            setContextMenu({ visible: false, x: 0, y: 0, itemPath: null, itemType: null });
                        }}
                    >
                        ✏️ Rename
                    </button>
                    <button
                        className='block w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 text-sm'
                        onClick={() => deleteItem(contextMenu.itemPath, contextMenu.itemType)}
                    >
                        🗑️ Delete
                    </button>
                </div>
            )}

            {/* Main Editor Area */}
            <div className='flex-1 flex flex-col'>
                {/* Header */}
                <div className='bg-gray-900 text-white p-2 border-b border-gray-600 flex items-center justify-between'>
                    <div className='flex items-center'>
                        <button
                            onClick={() => setShowFileExplorer(!showFileExplorer)}
                            className='mr-3 px-2 py-1 hover:bg-gray-700 rounded'
                            title="Toggle file explorer"
                        >
                            📁
                        </button>
                        <span className='text-sm font-medium'>
                            {activeFile ? getFileIcon(activeFile.split('/').pop()) : '📄'} {activeFile || 'No file selected'}
                        </span>
                        {activeFile && files[activeFile] && (
                            <span className='ml-2 text-xs text-gray-400'>
                                ({getLanguage(activeFile)})
                            </span>
                        )}
                    </div>
                    <div className='text-sm text-gray-400 flex items-center gap-4'>
                        <span>Room: {roomCode}</span>
                        <span className={getConnectionStatusColor()}>
                            {isSocketConnected && isRoomJoined ? '🟢' : isSocketConnected ? '🟡' : '🔴'}
                        </span>
                        <span>{isRoomJoined ? connectedUsers.length + 1 : 0} user{connectedUsers.length === 0 ? '' : 's'}</span>
                        <button
                            onClick={handleLogout}
                            className="text-red-400 hover:text-red-300 px-2 py-1 rounded"
                            title="Leave room"
                        >
                            🚪 Leave
                        </button>
                    </div>
                </div>

                {/* Editor */}
                <div className='flex-1'>
                    {activeFile && files[activeFile] && files[activeFile].type === 'file' && isRoomJoined ? (
                        <Editor
                            height='100%'
                            language={getLanguage(activeFile)}
                            value={code}
                            onChange={handleChange}
                            theme='vs-dark'
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                lineNumbers: 'on',
                                renderWhitespace: 'selection',
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                wordWrap: 'on',
                                tabSize: 2,
                                insertSpaces: true,
                                detectIndentation: false,
                                readOnly: !isSocketConnected || !isRoomJoined
                            }}
                        />
                    ) : (
                        <div className='flex items-center justify-center h-full text-gray-400 bg-gray-900'>
                            <div className="text-center">
                                <div className="text-6xl mb-4">
                                    {!isSocketConnected ? '🔌' : !isRoomJoined ? '🚪' : '📝'}
                                </div>
                                <div className="text-lg mb-2">
                                    {!isSocketConnected 
                                        ? 'Connecting to server...' 
                                        : !isRoomJoined 
                                        ? 'Joining room...' 
                                        : 'Select a file to start editing'}
                                </div>
                                <div className="text-sm text-gray-500">
                                    {connectionStatus}
                                </div>
                                {reconnectAttempts > 0 && (
                                    <div className="text-sm text-yellow-400 mt-2">
                                        Reconnection attempts: {reconnectAttempts}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Terminal */}
                <XTerminal socket={socket} roomCode={roomCode} isConnected={isSocketConnected && isRoomJoined} />
            </div>
        </div>
    );
}

// Helper function to get file icons
function getFileIcon(fileName) {
    if (!fileName || typeof fileName !== 'string') {
        return '📄';
    }
    const parts = fileName.split('.');
    const extension = parts.length > 1 ? parts.pop().toLowerCase() : '';
    const iconMap = {
        'js': '📄',
        'jsx': '⚛️',
        'ts': '📘',
        'tsx': '⚛️',
        'py': '🐍',
        'html': '🌐',
        'css': '🎨',
        'json': '📋',
        'md': '📝',
        'txt': '📄',
        'cpp': '⚙️',
        'c': '⚙️',
        'java': '☕',
        'go': '🐹',
        'rs': '🦀',
        'php': '🐘',
        'rb': '💎',
        'sh': '🖥️',
        'ps1': '💙'
    };
    return iconMap[extension] || '📄';
}

export default CollaborativeIDE;