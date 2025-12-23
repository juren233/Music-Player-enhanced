
import React, { useRef } from 'react';
import { ArrowLeft, User as UserIcon, Grid, Mic2, ListMusic, Upload, Search, X, Flame, Calendar, Play } from 'lucide-react';
import { RecommendedPlaylist, Track, Artist } from '../types';

export type SearchType = 'playlist' | 'song' | 'artist';
export type ViewType = 'recommend' | 'queue' | 'artist';

interface QueueDrawerProps {
  showQueue: boolean;
  setShowQueue: (show: boolean) => void;
  viewTab: ViewType;
  setViewTab: (view: ViewType) => void;
  isSearching: boolean;
  searchType: SearchType;
  handleTabChange: (type: SearchType) => void;
  clearSearch: () => void;
  tempPlaylistId: string;
  setTempPlaylistId: (val: string) => void;
  handleSearchSubmit: (e: React.FormEvent) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  
  // Data
  recommendations: RecommendedPlaylist[];
  playlistSearchResults: RecommendedPlaylist[];
  songSearchResults: Track[];
  artistSearchResults: Artist[];
  
  // Loading states
  isSearchLoading: boolean;
  isArtistLoading: boolean;
  
  // Artist Details
  artistDetail: any;
  artistSongs: Track[];
  artistSortOrder: 'hot' | 'time';
  handleArtistSortChange: (order: 'hot' | 'time') => void;
  
  // Handlers
  handleSongResultClick: (track: Track) => void;
  handleArtistResultClick: (id: number) => void;
  handleRecommendationClick: (id: number) => void;
  handleArtistSongClick: (track: Track) => void;
  
  // Player state for Queue list
  playlist: Track[];
  currentIndex: number;
  setCurrentIndex: (idx: number) => void;
  setIsPlaying: (playing: boolean) => void;
  
  isDarkMode: boolean;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  showQueue, setShowQueue, viewTab, setViewTab, isSearching, searchType, handleTabChange, clearSearch,
  tempPlaylistId, setTempPlaylistId, handleSearchSubmit, handleFileUpload,
  recommendations, playlistSearchResults, songSearchResults, artistSearchResults,
  isSearchLoading, isArtistLoading,
  artistDetail, artistSongs, artistSortOrder, handleArtistSortChange,
  handleSongResultClick, handleArtistResultClick, handleRecommendationClick, handleArtistSongClick,
  playlist, currentIndex, setCurrentIndex, setIsPlaying,
  isDarkMode
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Theme Constants for Overlay
    const overlayBg = isDarkMode ? 'bg-[#0f0f10]/95' : 'bg-white/95';
    const overlayBorder = isDarkMode ? 'border-white/10' : 'border-black/10';
    const headerBg = isDarkMode ? 'bg-black/20' : 'bg-slate-100/50';
    const headerBorder = isDarkMode ? 'border-white/5' : 'border-black/5';
    
    const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
    const textSecondary = isDarkMode ? 'text-white/60' : 'text-slate-500';
    const textTertiary = isDarkMode ? 'text-white/40' : 'text-slate-400';
    
    const itemHover = isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5';
    const activeItemBg = isDarkMode ? 'bg-white/10 text-white' : 'bg-black/5 text-black';
    
    const inputBg = isDarkMode ? 'bg-black/20 border-white/10 focus:bg-black/40 focus:border-white/30' : 'bg-black/5 border-black/10 focus:bg-white focus:border-black/20';
    const tabBg = isDarkMode ? 'bg-black/30' : 'bg-black/5';
    const pillBg = isDarkMode ? 'bg-white/10 border-white/5 shadow-lg' : 'bg-white border-black/5 shadow-sm';
    const cardBg = isDarkMode ? 'bg-white/5' : 'bg-black/5';

    // Determine what content to show in the Grid area
    let displayItems: any[] = [];
    let emptySearch = false;

    if (viewTab === 'artist') {
        displayItems = artistSongs;
    } else if (isSearching) {
        if (searchType === 'playlist') {
            displayItems = playlistSearchResults;
            emptySearch = !isSearchLoading && playlistSearchResults.length === 0;
        } else if (searchType === 'song') {
            displayItems = songSearchResults;
            emptySearch = !isSearchLoading && songSearchResults.length === 0;
        } else if (searchType === 'artist') {
            displayItems = artistSearchResults;
            emptySearch = !isSearchLoading && artistSearchResults.length === 0;
        }
    } else {
        displayItems = recommendations;
        emptySearch = false;
    }

    const showSkeleton = (isSearchLoading || isArtistLoading) || (viewTab === 'recommend' && !isSearching && recommendations.length === 0);

    return (
      <div className={`fixed inset-0 z-[60] transition-opacity duration-500 flex items-center justify-center ${showQueue ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-500" 
            onClick={() => setShowQueue(false)} 
          />
  
          {/* Content Container */}
          <div className={`relative w-full h-full md:inset-10 md:w-auto md:h-auto md:fixed md:rounded-2xl ${overlayBg} backdrop-blur-xl border ${overlayBorder} flex flex-col overflow-hidden shadow-2xl transition-transform duration-500 md:max-w-6xl md:min-w-[80vw] ${showQueue ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}>
              
              {/* Header / Tabs / Search */}
              <div className={`flex-none p-4 md:p-6 border-b ${headerBorder} flex flex-col md:flex-row gap-4 items-center justify-between ${headerBg}`}>
                   {/* Tabs / Back Button */}
                   {isSearching || viewTab === 'artist' ? (
                       <div className={`flex ${tabBg} p-1 rounded-lg self-start md:self-auto w-full md:w-auto overflow-x-auto no-scrollbar items-center`}>
                             <button 
                                 onClick={() => {
                                    if (viewTab === 'artist') {
                                        // Go back to search if we came from search, or recommend
                                        if (isSearching) setViewTab('recommend');
                                        else {
                                            setViewTab('queue'); // fallback
                                            setShowQueue(false);
                                        }
                                    } else {
                                        clearSearch();
                                    }
                                 }}
                                 className={`px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 ${textSecondary} hover:${textPrimary} ${itemHover} transition-all shrink-0 border-r ${isDarkMode ? 'border-white/5' : 'border-black/5'} mr-1`}
                             >
                                 <ArrowLeft className="w-4 h-4" />
                             </button>
                             {viewTab === 'artist' ? (
                                <div className={`px-4 py-2 text-sm font-bold ${textPrimary} flex items-center gap-2`}>
                                    <UserIcon className="w-4 h-4" /> 歌手详情
                                </div>
                             ) : (
                                <>
                                    <button 
                                        onClick={() => handleTabChange('playlist')}
                                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all shrink-0 border ${searchType === 'playlist' ? `${pillBg} ${textPrimary}` : `border-transparent ${textSecondary} hover:${textPrimary} ${itemHover}`}`}
                                    >
                                        <Grid className="w-4 h-4" /> 歌单
                                    </button>
                                    <button 
                                        onClick={() => handleTabChange('song')}
                                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all shrink-0 border ${searchType === 'song' ? `${pillBg} ${textPrimary}` : `border-transparent ${textSecondary} hover:${textPrimary} ${itemHover}`}`}
                                    >
                                        <Mic2 className="w-4 h-4" /> 单曲
                                    </button>
                                    <button 
                                        onClick={() => handleTabChange('artist')}
                                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all shrink-0 border ${searchType === 'artist' ? `${pillBg} ${textPrimary}` : `border-transparent ${textSecondary} hover:${textPrimary} ${itemHover}`}`}
                                    >
                                        <UserIcon className="w-4 h-4" /> 歌手
                                    </button>
                                </>
                             )}
                       </div>
                   ) : (
                      <div className={`relative flex ${tabBg} p-1 rounded-lg self-start md:self-auto w-full md:w-auto md:min-w-[340px] items-center isolate`}>
                            {/* Animated Background Pill */}
                            <div 
                                className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] ${pillBg} rounded-md transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] -z-10`}
                                style={{
                                    transform: viewTab === 'queue' ? 'translateX(100%)' : 'translateX(0%)'
                                }}
                            />
                            
                            <button 
                                onClick={() => setViewTab('recommend')}
                                className={`flex-1 px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-colors duration-300 ${viewTab === 'recommend' ? textPrimary : `${textTertiary} hover:${textSecondary}`}`}
                            >
                                <Grid className="w-4 h-4" /> 推荐歌单
                            </button>
                            <button 
                                onClick={() => setViewTab('queue')}
                                className={`flex-1 px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-colors duration-300 ${viewTab === 'queue' ? textPrimary : `${textTertiary} hover:${textSecondary}`}`}
                            >
                                <ListMusic className="w-4 h-4" /> 当前播放 ({playlist.length})
                            </button>
                      </div>
                   )}
  
                   <div className="flex gap-4 w-full md:w-auto items-center">
                       {/* Import Button */}
                       <input 
                           type="file" 
                           ref={fileInputRef} 
                           hidden 
                           accept=".zip" 
                           onChange={handleFileUpload} 
                       />
                       <button 
                            onClick={() => fileInputRef.current?.click()}
                            className={`p-2 rounded-md flex items-center gap-2 text-sm font-bold ${textSecondary} hover:${textPrimary} ${itemHover} transition-colors border ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}
                            title="导入本地 ZIP 压缩包"
                       >
                           <Upload className="w-4 h-4" /> 导入
                       </button>

                       {/* Search Input */}
                       <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-80 group">
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textTertiary} group-focus-within:${textSecondary} transition-colors`} />
                            <input 
                                value={tempPlaylistId}
                                onChange={(e) => setTempPlaylistId(e.target.value)}
                                placeholder="搜索歌单、单曲或歌手..."
                                className={`w-full ${inputBg} rounded-lg pl-10 pr-4 py-2.5 text-sm ${textPrimary} outline-none transition-all placeholder:${textTertiary}`}
                            />
                            {tempPlaylistId && (
                                <button type="button" onClick={() => setTempPlaylistId('')} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 ${textTertiary} hover:${textPrimary}`}>
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                       </form>
                       
                       <button onClick={() => setShowQueue(false)} className={`p-2 ${itemHover} rounded-full transition-colors shrink-0`}>
                          <X className={`w-6 h-6 ${textSecondary} hover:${textPrimary}`} />
                       </button>
                   </div>
              </div>
  
              {/* Content Body */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth no-scrollbar">
                  {viewTab === 'artist' ? (
                       // Artist Detail View
                       <div className="max-w-5xl mx-auto space-y-8 pb-20">
                           {/* Artist Header */}
                           {artistDetail && (
                               <div className={`flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 pb-4 border-b ${headerBorder} animate-fade-in`}>
                                   <div className={`w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden shadow-2xl border-4 ${isDarkMode ? 'border-white/5' : 'border-black/5'} shrink-0`}>
                                       <img src={artistDetail.picUrl || artistDetail.cover} className="w-full h-full object-cover" />
                                   </div>
                                   <div className="flex-1 text-center md:text-left">
                                       <h2 className={`text-3xl md:text-5xl font-bold ${textPrimary} mb-2`}>{artistDetail.name}</h2>
                                       <p className={`${textTertiary} text-sm max-w-2xl line-clamp-2 md:line-clamp-3 mb-4`}>{artistDetail.briefDesc || '暂无简介'}</p>
                                       
                                       <div className="flex items-center justify-center md:justify-start gap-4">
                                            {/* Sliding Pill Switcher for Artist Sort */}
                                           <div className={`relative flex ${tabBg} rounded-lg p-1 isolate`}>
                                                {/* Animated Background Pill */}
                                                <div 
                                                    className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] ${pillBg} rounded-md transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] -z-10`}
                                                    style={{
                                                        transform: artistSortOrder === 'time' ? 'translateX(100%)' : 'translateX(0%)'
                                                    }}
                                                />

                                                <button 
                                                    onClick={() => handleArtistSortChange('hot')}
                                                    className={`w-28 px-4 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-colors duration-300 ${artistSortOrder === 'hot' ? textPrimary : `${textTertiary} hover:${textSecondary}`}`}
                                                >
                                                    <Flame className="w-3 h-3" /> 最热歌曲
                                                </button>
                                                <button 
                                                    onClick={() => handleArtistSortChange('time')}
                                                    className={`w-28 px-4 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-colors duration-300 ${artistSortOrder === 'time' ? textPrimary : `${textTertiary} hover:${textSecondary}`}`}
                                                >
                                                    <Calendar className="w-3 h-3" /> 最新发布
                                                </button>
                                           </div>
                                       </div>
                                   </div>
                               </div>
                           )}

                           {/* Artist Song List */}
                           <div className="space-y-1">
                                {isArtistLoading ? (
                                     <div className="flex flex-col gap-4 animate-pulse">
                                        {!artistDetail && <div className={`h-48 w-full ${cardBg} rounded-2xl mb-8`}></div>}
                                        {Array(8).fill(0).map((_, i) => (
                                            <div key={i} className={`h-14 ${cardBg} rounded-lg w-full`} />
                                        ))}
                                     </div>
                                ) : artistSongs.length > 0 ? (
                                    artistSongs.map((track, i) => (
                                        <div 
                                            key={track.id} 
                                            onClick={() => handleArtistSongClick(track)}
                                            className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer group transition-all duration-300 ${itemHover} ${textSecondary} hover:${textPrimary} animate-fade-in-up`}
                                            style={{ animationDelay: `${i * 30}ms` }}
                                        >
                                            <div className="w-8 text-center text-sm font-mono opacity-30">{i + 1}</div>
                                            <div className="relative w-10 h-10 shrink-0">
                                                <img src={track.al.picUrl || track.al.pic_str} loading="lazy" className="w-full h-full rounded-md object-cover shadow-sm" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center rounded-md transition-colors">
                                                    <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all fill-current" />
                                                </div>
                                            </div>
                                            
                                            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                                <div className={`text-sm font-medium truncate ${textPrimary} flex items-center gap-2`}>
                                                    {track.name}
                                                    {(track.fee === 1 || track.fee === 4) && (
                                                        <span className="text-[9px] px-1 rounded-[3px] border border-amber-500 text-amber-500 font-normal leading-tight opacity-90 scale-90 origin-left shrink-0">VIP</span>
                                                    )}
                                                </div>
                                                <div className={`text-xs truncate ${textTertiary} group-hover:${textSecondary}`}>{track.al.name}</div>
                                            </div>

                                            <div className={`text-xs font-mono ${textTertiary} w-12 text-right group-hover:${textSecondary}`}>
                                                {Math.floor(track.dt / 1000 / 60)}:{(Math.floor(track.dt / 1000) % 60).toString().padStart(2, '0')}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    !isArtistLoading && <div className="text-center py-20 opacity-40">该筛选下暂无歌曲</div>
                                )}
                           </div>
                       </div>
                  ) : viewTab === 'recommend' ? (
                      <div className="pb-20">
                          {isSearching && (
                              <h3 className={`text-lg font-bold ${textPrimary} mb-6`}>
                                  {isSearchLoading ? '正在搜索...' : `"${tempPlaylistId}" 的搜索结果`}
                              </h3>
                          )}
                          
                          {emptySearch ? (
                              <div className="flex flex-col items-center justify-center opacity-40 py-20">
                                  <Search className="w-12 h-12 mb-4" />
                                  <p>未找到相关内容</p>
                              </div>
                          ) : (
                            <>
                                {/* Playlist Grid View */}
                                {(!isSearching || searchType === 'playlist') && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-8">
                                        {showSkeleton ? (
                                            Array(10).fill(0).map((_, i) => (
                                                <div key={i} className="flex flex-col gap-3">
                                                    <div className={`aspect-square rounded-xl ${cardBg} animate-pulse`} />
                                                    <div className={`h-4 ${cardBg} rounded w-3/4 animate-pulse`} />
                                                </div>
                                            ))
                                        ) : (
                                            displayItems.map((list: any) => (
                                                <div 
                                                    key={list.id} 
                                                    onClick={() => handleRecommendationClick(list.id)}
                                                    className="group cursor-pointer flex flex-col gap-3"
                                                >
                                                    <div className={`aspect-square rounded-xl overflow-hidden relative shadow-lg ${cardBg}`}>
                                                        <img src={list.picUrl} className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-105" loading="lazy" />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-white/10 transition-colors duration-300" />
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                                                                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                                                </div>
                                                        </div>
                                                        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] flex items-center gap-1 text-white/90 font-medium">
                                                            <Play className="w-3 h-3 fill-current" /> {(list.playCount / 10000).toFixed(0)}万
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className={`text-sm font-medium ${textSecondary} line-clamp-2 leading-relaxed group-hover:${textPrimary} transition-colors`}>{list.name}</h3>
                                                        {list.copywriter && <p className={`text-xs ${textTertiary} mt-1 truncate`}>{list.copywriter}</p>}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {/* Song Search View */}
                                {isSearching && searchType === 'song' && (
                                    <div className="space-y-1 max-w-4xl mx-auto">
                                        {displayItems.map((track: any, i) => (
                                            <div 
                                                key={track.id} 
                                                onClick={() => handleSongResultClick(track)}
                                                className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer group transition-all duration-300 ${itemHover} ${textSecondary} hover:${textPrimary}`}
                                            >
                                                <div className="relative w-12 h-12 shrink-0">
                                                    <img src={track.al.picUrl || track.al.pic_str} loading="lazy" className="w-full h-full rounded-md object-cover shadow-sm" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center rounded-md transition-colors">
                                                        <Play className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all fill-current" />
                                                    </div>
                                                </div>
                                                
                                                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                                    <div className={`text-base font-medium truncate ${textPrimary} flex items-center gap-2`}>
                                                        {track.name}
                                                        {(track.fee === 1 || track.fee === 4) && (
                                                            <span className="text-[10px] px-1 rounded-[3px] border border-amber-500 text-amber-500 font-normal leading-tight opacity-90 scale-90 origin-left shrink-0">VIP</span>
                                                        )}
                                                    </div>
                                                    <div className={`text-xs truncate ${textTertiary} group-hover:${textSecondary}`}>
                                                        {Array.isArray(track.ar) ? track.ar.map((a:any) => a.name).join(', ') : 'Unknown'}
                                                    </div>
                                                </div>

                                                <div className={`text-xs font-mono ${textTertiary} w-12 text-right group-hover:${textSecondary}`}>
                                                    {Math.floor(track.dt / 1000 / 60)}:{(Math.floor(track.dt / 1000) % 60).toString().padStart(2, '0')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Artist Search View */}
                                {isSearching && searchType === 'artist' && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                        {displayItems.map((artist: any) => (
                                            <div 
                                                key={artist.id} 
                                                onClick={() => handleArtistResultClick(artist.id)}
                                                className="group cursor-pointer flex flex-col items-center gap-3"
                                            >
                                                <div className={`aspect-square w-full rounded-full overflow-hidden relative shadow-lg ${cardBg}`}>
                                                    <img src={artist.picUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                                                         <UserIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all" />
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <h3 className={`text-sm font-medium ${textSecondary} group-hover:${textPrimary} transition-colors`}>{artist.name}</h3>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                          )}
                      </div>
                  ) : (
                      <div className="space-y-1 pb-20 max-w-4xl mx-auto">
                          {playlist.map((track, i) => (
                              <div 
                                  key={track.id} 
                                  onClick={() => { setCurrentIndex(i); setIsPlaying(true); }}
                                  className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer group transition-all duration-300 ${
                                      i === currentIndex 
                                          ? activeItemBg
                                          : `${textSecondary} ${itemHover} hover:${textPrimary}`
                                  }`}
                              >
                                  <div className="relative w-12 h-12 shrink-0">
                                    <img src={track.al.picUrl} loading="lazy" className="w-full h-full rounded-md object-cover shadow-sm" />
                                    {i === currentIndex && (
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-md backdrop-blur-[1px]">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                                        </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                      <div className={`text-base font-medium truncate flex items-center gap-2 ${i === currentIndex ? textPrimary : textSecondary}`}>
                                          {track.name}
                                          {(track.fee === 1 || track.fee === 4) && (
                                              <span className="text-[10px] px-1 rounded-[3px] border border-amber-500 text-amber-500 font-normal leading-tight opacity-90 scale-90 origin-left shrink-0">VIP</span>
                                          )}
                                      </div>
                                      <div className={`text-xs truncate ${textTertiary} group-hover:${textSecondary}`}>{track.ar.map(a => a.name).join(', ')}</div>
                                  </div>

                                  <div className={`text-xs font-mono ${textTertiary} w-12 text-right group-hover:${textSecondary}`}>
                                      {Math.floor(track.dt / 1000 / 60)}:{(Math.floor(track.dt / 1000) % 60).toString().padStart(2, '0')}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
  
          </div>
      </div>
    );
};
