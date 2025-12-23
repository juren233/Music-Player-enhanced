
import React from 'react';
import { MessageSquare, RefreshCw, X, Heart } from 'lucide-react';
import { Comment } from '../types';

interface CommentsDrawerProps {
  showComments: boolean;
  setShowComments: (show: boolean) => void;
  comments: Comment[];
  isRefreshingComments: boolean;
  handleRefreshComments: () => void;
  isDarkMode: boolean;
  layoutTransitionClass: string;
}

export const CommentsDrawer: React.FC<CommentsDrawerProps> = React.memo(({
  showComments, setShowComments, comments, isRefreshingComments, handleRefreshComments, isDarkMode, layoutTransitionClass
}) => {
    const textColor = isDarkMode ? 'text-white' : 'text-slate-900';
    const drawerBg = isDarkMode ? 'bg-neutral-900/95' : 'bg-white/90';
    const drawerBorder = isDarkMode ? 'border-white/5' : 'border-black/5';

    return (
        <>
        <div 
            className={`fixed inset-0 z-[55] bg-black/20 backdrop-blur-[1px] transition-opacity duration-500 ${showComments ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setShowComments(false)}
        />
        <div className={`fixed inset-y-0 right-0 w-full sm:w-[450px] backdrop-blur-3xl border-l shadow-2xl z-[60] transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${showComments ? 'translate-x-0' : 'translate-x-full'} ${drawerBg} ${drawerBorder} ${textColor} ${layoutTransitionClass}`}>
                <div className="flex flex-col h-full">
                    <div className={`p-6 pt-8 border-b flex items-center justify-between ${layoutTransitionClass} ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
                        <h2 className="text-lg font-bold flex items-center gap-2"><MessageSquare className="w-5 h-5" /> 精选评论</h2>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handleRefreshComments} 
                                className={`p-2 rounded-full ${layoutTransitionClass} ${isDarkMode ? 'bg-white/5 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}
                                title="刷新评论"
                            >
                                <RefreshCw className={`w-4 h-4 ${isRefreshingComments ? 'animate-spin' : ''}`} />
                            </button>
                            <button onClick={() => setShowComments(false)} className={`p-2 rounded-full ${layoutTransitionClass} ${isDarkMode ? 'bg-white/5 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'}`}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {comments.length > 0 ? comments.map(c => (
                            <div key={c.commentId} className="flex gap-4 group">
                                <img src={c.user.avatarUrl} loading="lazy" className={`w-10 h-10 rounded-full border shadow-sm ${layoutTransitionClass} ${isDarkMode ? 'border-white/10' : 'border-black/10'}`} />
                                <div className="flex-1">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-sm font-semibold opacity-90">{c.user.nickname}</span>
                                        <span className="text-xs opacity-30">{new Date(c.time).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-base opacity-90 leading-relaxed font-normal">{c.content}</p>
                                    <div className="flex items-center gap-1 mt-2 text-xs opacity-30 group-hover:opacity-50 transition-opacity">
                                        <Heart className="w-3 h-3" /> {c.likedCount}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center opacity-30 mt-20">暂无评论</div>
                        )}
                    </div>
                </div>
        </div>
        </>
    );
});
