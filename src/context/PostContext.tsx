import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  odds: number;
  confidence: number;
  created_at: string;
  likes: number;
  comments: number;
  shares: number;
  user: {
    username: string;
    avatar_url: string;
  };
}

interface PostContextType {
  posts: Post[];
  loading: boolean;
  hasMore: boolean;
  addPost: (post: Omit<Post, 'id' | 'created_at' | 'likes' | 'comments' | 'shares' | 'user'>) => Promise<void>;
  fetchMorePosts: () => Promise<void>;
}

const PostContext = createContext<PostContextType | undefined>(undefined);

const POSTS_PER_PAGE = 10;

export function PostProvider({ children }: { children: React.ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const fetchMorePosts = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          user:profiles(username, avatar_url)
        `)
        .range(page * POSTS_PER_PAGE, (page + 1) * POSTS_PER_PAGE - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setPosts(prev => [...prev, ...data]);
        setHasMore(data.length === POSTS_PER_PAGE);
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore]);

  const addPost = async (newPost: Omit<Post, 'id' | 'created_at' | 'likes' | 'comments' | 'shares' | 'user'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('posts')
        .insert([
          {
            ...newPost,
            user_id: user.id,
          }
        ])
        .select(`
          *,
          user:profiles(username, avatar_url)
        `)
        .single();

      if (error) throw error;

      if (data) {
        setPosts(prev => [data, ...prev]);
      }
    } catch (error) {
      console.error('Error adding post:', error);
      throw error;
    }
  };

  return (
    <PostContext.Provider value={{ posts, loading, hasMore, addPost, fetchMorePosts }}>
      {children}
    </PostContext.Provider>
  );
}

export function usePosts() {
  const context = useContext(PostContext);
  if (context === undefined) {
    throw new Error('usePosts must be used within a PostProvider');
  }
  return context;
}