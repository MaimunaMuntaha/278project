import { 
  collection, 
  doc, 
  getDocs, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  DocumentData,
  QuerySnapshot, 
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from '../firebase';

// Type definitions
export interface ProjectRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserEmail: string;
  fromUserAvatar?: string;
  toUserId: string; // project owner
  projectId?: string;
  projectName: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  type: 'join_project';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  hasDM?: boolean; // Whether a temporary DM has been created for this request
}

// Temporary DM for project requests
export interface RequestDM {
  id: string;
  requestId: string; // Links to the project request
  participants: string[]; // [requesterId, projectOwnerId]
  participantDetails: Record<string, {
    userId: string;
    displayName: string;
    email: string;
  }>;
  projectContext: {
    projectId: string;
    projectName: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    timestamp: Timestamp;
  };
  isActive: boolean;
}

export interface RequestDMMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Timestamp;
  type: 'text' | 'system';
}

export interface RequestItem {
  id: string;
  name: string;
  project: string;
  avatar?: any;
  message?: string;
  fromUserId: string;
  timestamp: Date;
  hasDM?: boolean; // Whether a DM exists for this request
}

export interface FirebaseChatMember {
  userId: string;
  displayName: string;
  email: string;
  joinedAt: Timestamp;
  role: 'owner' | 'admin' | 'member';
  lastReadMessageId?: string;
  lastReadAt?: Timestamp;
}

export interface FirebaseChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Timestamp;
  type: 'text' | 'image' | 'file';
  edited?: boolean;
  editedAt?: Timestamp;
}

export interface FirebaseGroupChat {
  id: string;
  projectName: string;
  description?: string;
  memberIds: string[]; // Array of user IDs for efficient querying
  members: Record<string, FirebaseChatMember>; // userId -> member info
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    timestamp: Timestamp;
  };
  isActive: boolean;
  settings: {
    allowInvites: boolean;
    isPublic: boolean;
  };
}

export class ChatService {
  // ============ GROUP CHAT FUNCTIONS ============
  
  // Get all group chats where user is a member
  static async getUserGroupChats(userId: string): Promise<FirebaseGroupChat[]> {
    try {
      const chatsRef = collection(db, 'groupChats');
      const q = query(
        chatsRef,
        where('memberIds', 'array-contains', userId),
        where('isActive', '==', true),
        orderBy('updatedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const chats: FirebaseGroupChat[] = [];
      
      querySnapshot.forEach((doc) => {
        chats.push({ id: doc.id, ...doc.data() } as FirebaseGroupChat);
      });
      
      return chats;
    } catch (error) {
      console.error('Error fetching user group chats:', error);
      return [];
    }
  }

  // Subscribe to real-time updates for user's group chats
  static subscribeToUserGroupChats(
    userId: string, 
    callback: (chats: FirebaseGroupChat[]) => void
  ): () => void {
    const chatsRef = collection(db, 'groupChats');
    const q = query(
      chatsRef,
      where('memberIds', 'array-contains', userId),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const chats: FirebaseGroupChat[] = [];
      querySnapshot.forEach((doc) => {
        chats.push({ id: doc.id, ...doc.data() } as FirebaseGroupChat);
      });
      callback(chats);
    }, (error) => {
      console.error('Error in chat subscription:', error);
    });

    return unsubscribe;
  }

  // Get unread message count for a chat
  static async getUnreadMessageCount(
    chatId: string, 
    userId: string, 
    lastReadMessageId?: string
  ): Promise<number> {
    try {
      if (!lastReadMessageId) {
        // If user has never read any messages, count all messages
        const messagesRef = collection(db, 'groupChats', chatId, 'messages');
        const querySnapshot = await getDocs(messagesRef);
        return querySnapshot.size;
      }

      // For now, return 0 if they have a lastReadMessageId
      // TODO: Implement proper timestamp-based unread counting
      return 0;
    } catch (error) {
      console.error('Error getting unread message count:', error);
      return 0;
    }
  }

  // Create a new group chat
  static async createGroupChat(
    projectName: string,
    description: string,
    creatorId: string,
    creatorName: string,
    creatorEmail: string
  ): Promise<string | null> {
    try {
      const chatsRef = collection(db, 'groupChats');
      const newChatRef = doc(chatsRef);
      
      const now = Timestamp.now();
      const newChat: Omit<FirebaseGroupChat, 'id'> = {
        projectName,
        description,
        memberIds: [creatorId],
        members: {
          [creatorId]: {
            userId: creatorId,
            displayName: creatorName,
            email: creatorEmail,
            joinedAt: now,
            role: 'owner'
          }
        },
        createdAt: now,
        updatedAt: now,
        isActive: true,
        settings: {
          allowInvites: true,
          isPublic: false
        }
      };

      await setDoc(newChatRef, newChat);
      return newChatRef.id;
    } catch (error) {
      console.error('Error creating group chat:', error);
      return null;
    }
  }

  // Subscribe to real-time messages for a group chat
  static subscribeToGroupChatMessages(
    chatId: string,
    callback: (messages: FirebaseChatMessage[]) => void
  ): () => void {
    const messagesRef = collection(db, 'groupChats', chatId, 'messages');
    const q = query(
      messagesRef,
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const messages: FirebaseChatMessage[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName,
          text: data.text,
          timestamp: data.timestamp,
          type: data.type || 'text',
          edited: data.edited || false,
          editedAt: data.editedAt
        } as FirebaseChatMessage);
      });
      callback(messages);
    }, (error) => {
      console.error('Error in messages subscription:', error);
    });

    return unsubscribe;
  }

  // Send a message to a group chat
  static async sendGroupChatMessage(
    chatId: string,
    senderId: string,
    senderName: string,
    text: string,
    type: 'text' | 'image' | 'file' = 'text'
  ): Promise<boolean> {
    try {
      const messagesRef = collection(db, 'groupChats', chatId, 'messages');
      const now = Timestamp.now();
      
      const newMessage: Omit<FirebaseChatMessage, 'id'> = {
        senderId,
        senderName,
        text,
        timestamp: now,
        type,
        edited: false
      };

      await addDoc(messagesRef, newMessage);

      const chatRef = doc(db, 'groupChats', chatId);
      await updateDoc(chatRef, {
        lastMessage: {
          text,
          senderId,
          senderName,
          timestamp: now
        },
        updatedAt: now
      });

      return true;
    } catch (error) {
      console.error('Error sending group chat message:', error);
      return false;
    }
  }

  // Get messages for a group chat (one-time fetch)
  static async getGroupChatMessages(
    chatId: string,
    messageLimit: number = 50
  ): Promise<FirebaseChatMessage[]> {
    try {
      const messagesRef = collection(db, 'groupChats', chatId, 'messages');
      const q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(messageLimit)
      );

      const querySnapshot = await getDocs(q);
      const messages: FirebaseChatMessage[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName,
          text: data.text,
          timestamp: data.timestamp,
          type: data.type || 'text',
          edited: data.edited || false,
          editedAt: data.editedAt
        } as FirebaseChatMessage);
      });

      return messages.reverse();
    } catch (error) {
      console.error('Error fetching group chat messages:', error);
      return [];
    }
  }

  static async getGroupChatById(chatId: string): Promise<FirebaseGroupChat | null> {
    try {
      const chatRef = doc(db, 'groupChats', chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        return null;
      }
      
      return { id: chatDoc.id, ...chatDoc.data() } as FirebaseGroupChat;
    } catch (error) {
      console.error('Error fetching group chat by ID:', error);
      return null;
    }
  }

  // Mark messages as read for a user
  static async markMessagesAsRead(
    chatId: string,
    userId: string,
    lastMessageId: string
  ): Promise<boolean> {
    try {
      const chatRef = doc(db, 'groupChats', chatId);
      await updateDoc(chatRef, {
        [`members.${userId}.lastReadMessageId`]: lastMessageId,
        [`members.${userId}.lastReadAt`]: Timestamp.now()
      });
      return true;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return false;
    }
  }

  // ============ REQUEST DM FUNCTIONS ============

  // Create a temporary DM for a project request
  static async createRequestDM(
    requestId: string,
    requesterId: string,
    requesterName: string,
    requesterEmail: string,
    ownerId: string,
    ownerName: string,
    ownerEmail: string,
    projectId: string,
    projectName: string
  ): Promise<string | null> {
    try {
      // Check if a DM already exists for this request
      const existingDM = await this.getRequestDMByRequestId(requestId);
      if (existingDM) {
        return existingDM.id;
      }

      const requestDMsRef = collection(db, 'requestDMs');
      const newDMRef = doc(requestDMsRef);
      
      const now = Timestamp.now();
      const participants = [requesterId, ownerId].sort(); // Sort for consistency
      
      const newRequestDM: Omit<RequestDM, 'id'> = {
        requestId,
        participants,
        participantDetails: {
          [requesterId]: {
            userId: requesterId,
            displayName: requesterName,
            email: requesterEmail
          },
          [ownerId]: {
            userId: ownerId,
            displayName: ownerName,
            email: ownerEmail
          }
        },
        projectContext: {
          projectId,
          projectName
        },
        createdAt: now,
        updatedAt: now,
        isActive: true
      };

      await setDoc(newDMRef, newRequestDM);

      // Mark the request as having a DM
      const requestRef = doc(db, 'projectRequests', requestId);
      await updateDoc(requestRef, {
        hasDM: true,
        updatedAt: now
      });

      // Add a system message to start the conversation
      await this.sendRequestDMMessage(
        newDMRef.id,
        'system',
        'System',
        `This is a temporary chat about the request to join "${projectName}". This conversation will be closed when the request is resolved.`,
        'system'
      );

      return newDMRef.id;
    } catch (error) {
      console.error('Error creating request DM:', error);
      return null;
    }
  }

  // Get request DM by request ID
  static async getRequestDMByRequestId(requestId: string): Promise<RequestDM | null> {
    try {
      const requestDMsRef = collection(db, 'requestDMs');
      const q = query(
        requestDMsRef,
        where('requestId', '==', requestId),
        where('isActive', '==', true),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as RequestDM;
      }
      return null;
    } catch (error) {
      console.error('Error getting request DM by request ID:', error);
      return null;
    }
  }

  // Get request DM by ID
  static async getRequestDMById(dmId: string): Promise<RequestDM | null> {
    try {
      const dmRef = doc(db, 'requestDMs', dmId);
      const dmDoc = await getDoc(dmRef);
      
      if (!dmDoc.exists()) {
        return null;
      }
      
      return { id: dmDoc.id, ...dmDoc.data() } as RequestDM;
    } catch (error) {
      console.error('Error fetching request DM by ID:', error);
      return null;
    }
  }

  // Get all active request DMs for a user
  static async getUserRequestDMs(userId: string): Promise<RequestDM[]> {
    try {
      const requestDMsRef = collection(db, 'requestDMs');
      const q = query(
        requestDMsRef,
        where('participants', 'array-contains', userId),
        where('isActive', '==', true),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const dms: RequestDM[] = [];
      
      querySnapshot.forEach((doc) => {
        dms.push({ id: doc.id, ...doc.data() } as RequestDM);
      });

      return dms;
    } catch (error) {
      console.error('Error fetching user request DMs:', error);
      return [];
    }
  }

  // Subscribe to real-time updates for user's request DMs
  static subscribeToUserRequestDMs(
    userId: string,
    callback: (dms: RequestDM[]) => void
  ): () => void {
    const requestDMsRef = collection(db, 'requestDMs');
    const q = query(
      requestDMsRef,
      where('participants', 'array-contains', userId),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const dms: RequestDM[] = [];
      querySnapshot.forEach((doc) => {
        dms.push({ id: doc.id, ...doc.data() } as RequestDM);
      });
      callback(dms);
    }, (error) => {
      console.error('Error in request DM subscription:', error);
    });

    return unsubscribe;
  }

  // Send a message in a request DM
  static async sendRequestDMMessage(
    dmId: string,
    senderId: string,
    senderName: string,
    text: string,
    type: 'text' | 'system' = 'text'
  ): Promise<boolean> {
    try {
      const messagesRef = collection(db, 'requestDMs', dmId, 'messages');
      const now = Timestamp.now();
      
      const newMessage: Omit<RequestDMMessage, 'id'> = {
        senderId,
        senderName,
        text,
        timestamp: now,
        type
      };

      // Add the message to the messages subcollection
      await addDoc(messagesRef, newMessage);

      // Update the DM's last message (unless it's a system message)
      if (type !== 'system') {
        const dmRef = doc(db, 'requestDMs', dmId);
        await updateDoc(dmRef, {
          lastMessage: {
            text,
            senderId,
            senderName,
            timestamp: now
          },
          updatedAt: now
        });
      }

      return true;
    } catch (error) {
      console.error('Error sending request DM message:', error);
      return false;
    }
  }

  // Subscribe to real-time messages for a request DM
  static subscribeToRequestDMMessages(
    dmId: string,
    callback: (messages: RequestDMMessage[]) => void
  ): () => void {
    const messagesRef = collection(db, 'requestDMs', dmId, 'messages');
    const q = query(
      messagesRef,
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const messages: RequestDMMessage[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName,
          text: data.text,
          timestamp: data.timestamp,
          type: data.type || 'text'
        } as RequestDMMessage);
      });
      callback(messages);
    }, (error) => {
      console.error('Error in request DM messages subscription:', error);
    });

    return unsubscribe;
  }

  // Close a request DM (when request is resolved)
  static async closeRequestDM(requestId: string): Promise<boolean> {
    try {
      const requestDM = await this.getRequestDMByRequestId(requestId);
      if (!requestDM) {
        return true; // Already closed or doesn't exist
      }

      const dmRef = doc(db, 'requestDMs', requestDM.id);
      await updateDoc(dmRef, {
        isActive: false,
        updatedAt: Timestamp.now()
      });

      return true;
    } catch (error) {
      console.error('Error closing request DM:', error);
      return false;
    }
  }

  // ============ REQUEST MANAGEMENT FUNCTIONS ============

  // Create a new project request
  static async createProjectRequest(
    fromUserId: string,
    fromUserName: string,
    fromUserEmail: string,
    toUserId: string,
    projectName: string,
    message?: string,
    projectId?: string
  ): Promise<string | null> {
    try {
      // Check if request already exists
      const existingRequest = await this.getExistingRequest(fromUserId, toUserId, projectName);
      if (existingRequest) {
        console.log('Request already exists');
        return existingRequest.id;
      }

      const requestsRef = collection(db, 'projectRequests');
      const now = Timestamp.now();
      
      const newRequest: Omit<ProjectRequest, 'id'> = {
        fromUserId,
        fromUserName,
        fromUserEmail,
        toUserId,
        projectId,
        projectName,
        message,
        status: 'pending',
        type: 'join_project',
        createdAt: now,
        updatedAt: now
      };

      const docRef = await addDoc(requestsRef, newRequest);
      return docRef.id;
    } catch (error) {
      console.error('Error creating project request:', error);
      return null;
    }
  }

  // Check if a request already exists
  private static async getExistingRequest(
    fromUserId: string,
    toUserId: string,
    projectName: string
  ): Promise<ProjectRequest | null> {
    try {
      const requestsRef = collection(db, 'projectRequests');
      const q = query(
        requestsRef,
        where('fromUserId', '==', fromUserId),
        where('toUserId', '==', toUserId),
        where('projectName', '==', projectName),
        where('type', '==', 'join_project'),
        where('status', '==', 'pending')
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as ProjectRequest;
      }
      return null;
    } catch (error) {
      console.error('Error checking existing request:', error);
      return null;
    }
  }

  // Get all requests sent by a user (outgoing requests)
  static async getUserSentRequests(userId: string): Promise<ProjectRequest[]> {
    try {
      const requestsRef = collection(db, 'projectRequests');
      const q = query(
        requestsRef,
        where('fromUserId', '==', userId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const requests: ProjectRequest[] = [];
      
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as ProjectRequest);
      });

      return requests;
    } catch (error) {
      console.error('Error fetching user sent requests:', error);
      return [];
    }
  }

  // Subscribe to real-time updates for user's sent requests
  static subscribeToUserSentRequests(
    userId: string,
    callback: (requests: ProjectRequest[]) => void
  ): () => void {
    const requestsRef = collection(db, 'projectRequests');
    const q = query(
      requestsRef,
      where('fromUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const requests: ProjectRequest[] = [];
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as ProjectRequest);
      });
      callback(requests);
    }, (error) => {
      console.error('Error in sent requests subscription:', error);
    });

    return unsubscribe;
  }
  static async getUserRequests(userId: string): Promise<ProjectRequest[]> {
    try {
      const requestsRef = collection(db, 'projectRequests');
      const q = query(
        requestsRef,
        where('toUserId', '==', userId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const requests: ProjectRequest[] = [];
      
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as ProjectRequest);
      });

      return requests;
    } catch (error) {
      console.error('Error fetching user requests:', error);
      return [];
    }
  }

  // Subscribe to real-time updates for user requests
  static subscribeToUserRequests(
    userId: string,
    callback: (requests: ProjectRequest[]) => void
  ): () => void {
    const requestsRef = collection(db, 'projectRequests');
    const q = query(
      requestsRef,
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const requests: ProjectRequest[] = [];
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as ProjectRequest);
      });
      callback(requests);
    }, (error) => {
      console.error('Error in requests subscription:', error);
    });

    return unsubscribe;
  }

  // Accept a project request
  static async acceptProjectRequest(requestId: string): Promise<boolean> {
    try {
      const requestRef = doc(db, 'projectRequests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        console.error('Request not found');
        return false;
      }

      const request = { id: requestDoc.id, ...requestDoc.data() } as ProjectRequest;

      // Update request status
      await updateDoc(requestRef, {
        status: 'accepted',
        updatedAt: Timestamp.now()
      });

      // Close any associated request DM
      await this.closeRequestDM(requestId);

      // Find or create group chat for the project
      let groupChat = await this.getGroupChatByProjectName(request.projectName);
      
      if (!groupChat) {
        console.log(`No group chat found for project: ${request.projectName}. Creating one...`);
        
        const projectOwner = await this.getProjectOwnerDetails(request.toUserId, request.projectName);
        
        if (projectOwner) {
          const groupChatId = await this.createGroupChat(
            request.projectName,
            `Group chat for ${request.projectName}`,
            request.toUserId,
            projectOwner.displayName,
            projectOwner.email
          );
          
          if (groupChatId) {
            console.log(`Created new group chat ${groupChatId} for project ${request.projectName}`);
            groupChat = await this.getGroupChatByProjectName(request.projectName);
          }
        }
      }
      
      if (groupChat) {
        const success = await this.addUserToGroupChat(
          groupChat.id,
          request.fromUserId,
          request.fromUserName,
          request.fromUserEmail
        );
        
        if (!success) {
          console.error('Failed to add user to group chat');
          return false;
        }
      } else {
        console.error(`Failed to create or find group chat for project: ${request.projectName}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error accepting project request:', error);
      return false;
    }
  }

  // Helper method to get project owner details
  static async getProjectOwnerDetails(
    ownerId: string, 
    projectName: string
  ): Promise<{ displayName: string; email: string } | null> {
    try {
      // First, try to get details from the users collection
      const userRef = doc(db, 'users', ownerId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          displayName: userData.displayName || userData.username || 'Anonymous',
          email: userData.email || ''
        };
      }
      
      // Fallback: Get details from the project post
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef,
        where('uid', '==', ownerId),
        where('title', '==', projectName),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const postData = querySnapshot.docs[0].data();
        return {
          displayName: postData.username || 'Anonymous',
          email: ''
        };
      }
      
      return {
        displayName: 'Project Owner',
        email: ''
      };
    } catch (error) {
      console.error('Error fetching project owner details:', error);
      return {
        displayName: 'Project Owner',
        email: ''
      };
    }
  }

  // Decline a project request
  static async declineProjectRequest(requestId: string): Promise<boolean> {
    try {
      const requestRef = doc(db, 'projectRequests', requestId);
      await updateDoc(requestRef, {
        status: 'declined',
        updatedAt: Timestamp.now()
      });

      // Close any associated request DM
      await this.closeRequestDM(requestId);
      
      return true;
    } catch (error) {
      console.error('Error declining project request:', error);
      return false;
    }
  }

  // Add user to an existing group chat
  static async addUserToGroupChat(
    chatId: string,
    userId: string,
    userName: string,
    userEmail: string
  ): Promise<boolean> {
    try {
      const chatRef = doc(db, 'groupChats', chatId);
      const memberData: FirebaseChatMember = {
        userId,
        displayName: userName,
        email: userEmail,
        joinedAt: Timestamp.now(),
        role: 'member'
      };

      await updateDoc(chatRef, {
        [`members.${userId}`]: memberData,
        memberIds: arrayUnion(userId),
        updatedAt: Timestamp.now()
      });

      return true;
    } catch (error) {
      console.error('Error adding user to group chat:', error);
      return false;
    }
  }

  // Get group chat by project name (for finding existing chats)
  static async getGroupChatByProjectName(projectName: string): Promise<FirebaseGroupChat | null> {
    try {
      const chatsRef = collection(db, 'groupChats');
      const q = query(
        chatsRef,
        where('projectName', '==', projectName),
        where('isActive', '==', true),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as FirebaseGroupChat;
      }
      return null;
    } catch (error) {
      console.error('Error finding group chat by project name:', error);
      return null;
    }
  }

  // Convert ProjectRequest to RequestItem for UI compatibility
  static convertProjectRequestToRequestItem(request: ProjectRequest): RequestItem {
    return {
      id: request.id,
      name: request.fromUserName,
      project: request.projectName,
      avatar: request.fromUserAvatar || null,
      message: request.message,
      fromUserId: request.fromUserId,
      timestamp: request.createdAt.toDate(),
      hasDM: request.hasDM || false
    };
  }

  // Batch convert requests
  static convertProjectRequestsToRequestItems(requests: ProjectRequest[]): RequestItem[] {
    return requests.map(request => this.convertProjectRequestToRequestItem(request));
  }
}