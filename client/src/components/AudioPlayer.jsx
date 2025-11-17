import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, ExternalLink } from 'lucide-react';

const AudioPlayer = ({ compact = false, mobileConfig }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playMode, setPlayMode] = useState('single'); // 'single', 'repeat', 'shuffle'

  const playlist = [
    {
      title: 'Chloe',
      artist: 'Neal K',
      subtitle: 'Dreamy piano music',
      src: 'https://d2lals9bcc7in1.cloudfront.net/audio/chloe-neal-k.mp3',
      license: 'https://www.youtube.com/watch?v=-aoWKV9wFIw&list=RD-aoWKV9wFIw&start_radio=1'
    },
    {
      title: 'Stellar Mist (별안개)',
      artist: 'XYNSIA',
      subtitle: 'Piano Instrumental Ver.',
      src: 'https://d2lals9bcc7in1.cloudfront.net/audio/stellar-mist-xynsia.opus',
      license: 'https://www.youtube.com/watch?v=65NntC7mgPw&list=RD65NntC7mgPw&start_radio=1'
    },
    {
      title: 'Catch Me If You Can',
      artist: 'HYP Music',
      subtitle: 'Upbeat piano music',
      src: 'https://d2lals9bcc7in1.cloudfront.net/audio/catch-me-if-you-can-hyp.opus',
      license: 'https://www.youtube.com/watch?v=LrTkfYqNJFU&list=RDLrTkfYqNJFU&start_radio=1'
    },
    {
      title: '붉은 연꽃 - 홍련',
      artist: 'Neal K',
      subtitle: 'Oriental epic music',
      src: 'https://d2lals9bcc7in1.cloudfront.net/audio/red-lotus-neal-k.opus',
      license: 'https://youtu.be/bxL3fgAa9gw?si=0lLN2zIfWpos39Go5'
    },
    {
      title: 'Again - 어게인',
      artist: 'Neal K',
      subtitle: 'Dreamy epic piano',
      src: 'https://d2lals9bcc7in1.cloudfront.net/audio/again-neal-k.opus',
      license: 'https://www.youtube.com/watch?v=xjSp2sIQAWY&list=RDxjSp2sIQAWY&start_radio=1'
    }
  ];

  const [currentTrack, setCurrentTrack] = useState(0);

  // 이전 곡 재생
  const playPreviousTrack = async () => {
    const newIndex = currentTrack - 1;
    if (newIndex >= 0) {
      setCurrentTrack(newIndex);
      setIsPlaying(false);
      setTimeout(async () => {
        if (audioRef.current) {
          try {
            await audioRef.current.play();
            setIsPlaying(true);
          } catch (error) {
            console.error('이전 곡 재생 오류:', error);
          }
        }
      }, 100);
    }
  };

  // 다음 곡 재생
  const playNextTrack = async () => {
    const newIndex = currentTrack + 1;
    if (newIndex < playlist.length) {
      setCurrentTrack(newIndex);
      setIsPlaying(false);
      setTimeout(async () => {
        if (audioRef.current) {
          try {
            await audioRef.current.play();
            setIsPlaying(true);
          } catch (error) {
            console.error('다음 곡 재생 오류:', error);
          }
        }
      }, 100);
    }
  };

  // 곡 종료 핸들러
  const handleEnded = () => {
    if (playMode === 'single') {
      // 단독재생: 다음 곡이 있으면 재생, 없으면 정지
      if (currentTrack < playlist.length - 1) {
        playNextTrack();
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    } else if (playMode === 'repeat') {
      // 순차재생: 마지막 곡이면 처음 곡으로, 아니면 다음 곡으로
      if (currentTrack < playlist.length - 1) {
        playNextTrack();
      } else {
        setCurrentTrack(0);
        setTimeout(async () => {
          if (audioRef.current) {
            try {
              await audioRef.current.play();
              setIsPlaying(true);
            } catch (err) {
              console.error('자동 재생 실패:', err);
              setIsPlaying(false);
            }
          }
        }, 100);
      }
    } else if (playMode === 'shuffle') {
      // 셔플: 랜덤 곡 선택
      const randomIndex = Math.floor(Math.random() * playlist.length);
      setCurrentTrack(randomIndex);
      setTimeout(async () => {
        if (audioRef.current) {
          try {
            await audioRef.current.play();
            setIsPlaying(true);
          } catch (err) {
            console.error('자동 재생 실패:', err);
            setIsPlaying(false);
          }
        }
      }, 100);
    }
  };

  // 오디오 이벤트 리스너 등록
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  });

  // 볼륨 조절
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // 트랙 변경 시 오디오 로드
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
      setCurrentTime(0);
    }
  }, [currentTrack]);

  // 컴포넌트 마운트 시 자동 재생 비활성화 (사용자가 수동으로 재생해야 함)
  // useEffect(() => {
  //   const autoPlayAudio = async () => {
  //     if (audioRef.current) {
  //       try {
  //         await audioRef.current.play();
  //         setIsPlaying(true);
  //       } catch (error) {
  //         // 브라우저 자동 재생 정책에 의해 차단될 수 있음
  //         // 사용자가 수동으로 재생할 수 있도록 에러를 무시
  //         console.log('자동 재생이 차단되었습니다. 수동으로 재생해주세요.');
  //       }
  //     }
  //   };

  //   // 컴포넌트 마운트 후 짧은 딜레이를 주고 자동 재생 시도
  //   const timer = setTimeout(() => {
  //     autoPlayAudio();
  //   }, 500);

  //   return () => clearTimeout(timer);
  // }, []); // 빈 배열로 마운트 시에만 실행

  // 플레이리스트 외부 클릭 시 닫기
  useEffect(() => {
    if (!showPlaylist) return;
    
    const handleClickOutside = (e) => {
      if (!e.target.closest('.relative')) {
        setShowPlaylist(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showPlaylist]);
  
  const togglePlayMode = () => {
    if (playMode === 'single') {
      setPlayMode('repeat');
    } else if (playMode === 'repeat') {
      setPlayMode('shuffle');
    } else {
      setPlayMode('single');
    }
  };

  const togglePlay = async () => {
    if (audioRef.current) {
      try {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          await audioRef.current.play();
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('재생 오류:', error);
        setIsPlaying(false);
        alert('오디오 재생에 실패했습니다. 페이지와 상호작용 후 다시 시도해주세요.');
      }
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const selectTrack = async (index) => {
    if (index === currentTrack) {
      setShowPlaylist(false);
      return;
    }
    
    setCurrentTrack(index);
    setIsPlaying(false);
    setShowPlaylist(false);
    
    setTimeout(async () => {
      if (audioRef.current) {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (error) {
          console.error('곡 선택 재생 오류:', error);
        }
      }
    }, 100);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Compact mode for sidebar
  if (compact) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <audio ref={audioRef} src={playlist[currentTrack].src} preload="metadata" />
        
        {/* Track Info with Link */}
        <div 
          className="w-full px-1 cursor-pointer hover:bg-white/5 rounded p-1 transition-colors relative"
          onClick={() => setShowPlaylist(!showPlaylist)}
        >
          <div className="flex items-start justify-between gap-1">
            <div className="flex-1 min-w-0">
              <div className={`text-white font-semibold ${mobileConfig?.isMobile ? 'text-[9px]' : 'text-xs'} truncate`}>
                {playlist[currentTrack].title}
              </div>
              <div className={`text-gray-400 ${mobileConfig?.isMobile ? 'text-[8px]' : 'text-[10px]'} truncate`}>
                {playlist[currentTrack].artist}
              </div>
              <div className={`text-gray-500 ${mobileConfig?.isMobile ? 'text-[7px]' : 'text-[9px]'} truncate`}>
                {playlist[currentTrack].subtitle}
              </div>
            </div>
            <a
              href={playlist[currentTrack].license}
              target="_blank"
              rel="noopener noreferrer"
              className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
              title="Music Source"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={12} className="text-gray-400 hover:text-white" />
            </a>
          </div>

          {/* Playlist Dropdown */}
          {showPlaylist && (
            <div className="absolute left-full top-0 ml-2 bg-gray-800/95 backdrop-blur-md border border-gray-700 rounded-lg shadow-xl w-[280px] max-h-[400px] overflow-y-auto z-[70]">
              <div className="p-2">
                <div className="text-gray-400 text-xs font-semibold mb-2 px-2">
                  Playlist ({playlist.length})
                </div>
                {playlist.map((track, index) => (
                  <div
                    key={index}
                    onClick={() => selectTrack(index)}
                    className={`p-2 rounded-lg cursor-pointer transition-all ${
                      index === currentTrack
                        ? 'bg-gray-700 border border-gray-600'
                        : 'hover:bg-gray-700/50'
                    }`}
                  >
                    <div className={`font-semibold text-xs truncate ${
                      index === currentTrack ? 'text-white' : 'text-gray-200'
                    }`}>
                      {track.title}
                    </div>
                    <div className="text-gray-400 text-[10px] truncate">
                      {track.artist}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={playPreviousTrack}
            disabled={currentTrack === 0}
            className={`p-1.5 rounded-full transition-colors ${
              currentTrack === 0 
                ? 'opacity-30 cursor-not-allowed' 
                : 'hover:bg-white/10 cursor-pointer'
            }`}
            title="이전 곡"
            type="button"
          >
            <SkipBack size={14} className="text-white pointer-events-none" />
          </button>

          <button
            onClick={togglePlay}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer"
            title={isPlaying ? '일시정지' : '재생'}
            type="button"
          >
            {isPlaying ? (
              <Pause size={16} className="text-white pointer-events-none" />
            ) : (
              <Play size={16} className="text-white pointer-events-none" />
            )}
          </button>
          
          <button
            onClick={playNextTrack}
            disabled={currentTrack === playlist.length - 1}
            className={`p-1.5 rounded-full transition-colors ${
              currentTrack === playlist.length - 1 
                ? 'opacity-30 cursor-not-allowed' 
                : 'hover:bg-white/10 cursor-pointer'
            }`}
            title="다음 곡"
            type="button"
          >
            <SkipForward size={14} className="text-white pointer-events-none" />
          </button>

          <button
            onClick={toggleMute}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title={isMuted ? '음소거 해제' : '음소거'}
            type="button"
          >
            {isMuted || volume === 0 ? (
              <VolumeX size={14} className="text-white pointer-events-none" />
            ) : (
              <Volume2 size={14} className="text-white pointer-events-none" />
            )}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex flex-col gap-1 w-full px-1">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-gray-700 rounded-full outline-none appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 
              [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:bg-white 
              [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer"
            style={{
              background: `linear-gradient(to right, #fff ${(currentTime / duration) * 100}%, #374151 ${(currentTime / duration) * 100}%)`
            }}
          />
          <div className="flex justify-between w-full text-[9px] text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Regular mode
  return (
    <div className="bg-gradient-to-r from-gray-900/70 to-gray-800/70 border-b-2 border-gray-700/70 shadow-lg backdrop-blur-sm sticky top-0 z-[60]">
      <audio ref={audioRef} src={playlist[currentTrack].src} preload="metadata" />
      
      <div className="max-w-7xl mx-auto px-3 py-2">
        <div className="flex items-center gap-3">
          {/* 트랙 정보 */}
          <div className="min-w-[180px] hidden sm:block relative">
            <div 
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-700/50 rounded px-2 py-1 transition-colors"
              onClick={() => setShowPlaylist(!showPlaylist)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm truncate">
                  {playlist[currentTrack].title}
                </div>
                <div className="text-gray-300 text-xs truncate">
                  {playlist[currentTrack].artist}
                </div>
                <div className="text-gray-400 text-[10px] truncate">
                  {playlist[currentTrack].subtitle}
                </div>
              </div>
              <a
                href={playlist[currentTrack].license}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                title="Music Source License"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={14} className="text-gray-400 hover:text-white" />
              </a>
            </div>

            {/* 플레이리스트 드롭다운 */}
            {showPlaylist && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800/95 backdrop-blur-md border border-gray-700 rounded-lg shadow-xl min-w-[280px] max-h-[400px] overflow-y-auto z-[70]">
                <div className="p-2">
                  <div className="text-gray-400 text-xs font-semibold mb-2 px-2">
                    Playlist ({playlist.length} tracks)
                  </div>
                  {playlist.map((track, index) => (
                    <div
                      key={index}
                      onClick={() => selectTrack(index)}
                      className={`p-2 rounded-lg cursor-pointer transition-all ${
                        index === currentTrack
                          ? 'bg-gray-700 border border-gray-600'
                          : 'hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold text-xs truncate ${
                            index === currentTrack ? 'text-white' : 'text-gray-200'
                          }`}>
                            {track.title}
                          </div>
                          <div className="text-gray-400 text-[10px] truncate">
                            {track.artist}
                          </div>
                        </div>
                        {index === currentTrack && (
                          <div className="flex-shrink-0 text-green-400 text-xs">
                            {isPlaying ? '▶' : '⏸'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 재생 컨트롤 */}
          <div className="flex items-center gap-2 relative z-50">
            <button
              onClick={playPreviousTrack}
              disabled={currentTrack === 0}
              className={`p-1.5 rounded-full transition-colors relative ${
                currentTrack === 0 
                  ? 'opacity-30 cursor-not-allowed' 
                  : 'hover:bg-gray-700 cursor-pointer'
              }`}
              title="이전 곡"
              type="button"
            >
              <SkipBack size={16} className="text-white pointer-events-none" />
            </button>
            
            <button
              onClick={togglePlay}
              className="p-2 bg-white hover:bg-gray-100 rounded-full transition-all shadow-md relative cursor-pointer"
              title={isPlaying ? '일시정지' : '재생'}
              type="button"
            >
              {isPlaying ? (
                <Pause size={18} className="text-gray-800 pointer-events-none" fill="currentColor" />
              ) : (
                <Play size={18} className="text-gray-800 pointer-events-none" fill="currentColor" />
              )}
            </button>

            <button
              onClick={playNextTrack}
              disabled={currentTrack === playlist.length - 1}
              className={`p-1.5 rounded-full transition-colors relative ${
                currentTrack === playlist.length - 1 
                  ? 'opacity-30 cursor-not-allowed' 
                  : 'hover:bg-gray-700 cursor-pointer'
              }`}
              title="다음 곡"
              type="button"
            >
              <SkipForward size={16} className="text-white pointer-events-none" />
            </button>
            
            {/* 재생 모드 토글 */}
            <button
              onClick={togglePlayMode}
              className={`p-1.5 hover:bg-gray-700 rounded-full transition-all relative cursor-pointer ${
                playMode !== 'single' ? 'bg-gray-700' : ''
              }`}
              title={
                playMode === 'single' ? '단독재생' : 
                playMode === 'repeat' ? '순차재생' : 
                '셔플재생'
              }
              type="button"
            >
              {playMode === 'single' ? (
                <Repeat1 size={16} className="text-white pointer-events-none" />
              ) : playMode === 'repeat' ? (
                <Repeat size={16} className="text-white pointer-events-none" />
              ) : (
                <Shuffle size={16} className="text-white pointer-events-none" />
              )}
            </button>
          </div>

          {/* 진행 바 */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-gray-300 text-xs font-mono min-w-[35px]">
              {formatTime(currentTime)}
            </span>
            
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-gray-700 rounded-full outline-none appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:shadow-md
                [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-white 
                [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer"
              style={{
                background: `linear-gradient(to right, #fff ${(currentTime / duration) * 100}%, #374151 ${(currentTime / duration) * 100}%)`
              }}
            />
            
            <span className="text-gray-300 text-xs font-mono min-w-[35px]">
              {formatTime(duration)}
            </span>
          </div>

          {/* 볼륨 컨트롤 */}
          <div 
            className="relative flex items-center gap-2 z-50"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={toggleMute}
              className="p-1.5 hover:bg-gray-700 rounded-full transition-colors relative cursor-pointer"
              title={isMuted ? '음소거 해제' : '음소거'}
              type="button"
            >
              {isMuted || volume === 0 ? (
                <VolumeX size={18} className="text-white pointer-events-none" />
              ) : (
                <Volume2 size={18} className="text-white pointer-events-none" />
              )}
            </button>

            <div className={`transition-all duration-200 overflow-hidden ${
              showVolumeSlider ? 'w-20 opacity-100' : 'w-0 opacity-0'
            }`}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full h-1.5 bg-gray-700 rounded-full outline-none appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                  [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-white 
                  [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer"
              />
            </div>
          </div>

          {/* 모바일 트랙 정보 */}
          <div className="sm:hidden flex-1 min-w-0 relative">
            <div 
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-700/50 rounded px-2 py-1 transition-colors"
              onClick={() => setShowPlaylist(!showPlaylist)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-xs truncate">
                  {playlist[currentTrack].title}
                </div>
                <div className="text-gray-400 text-[10px] truncate">
                  {playlist[currentTrack].artist}
                </div>
              </div>
              <a
                href={playlist[currentTrack].license}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                title="Music Source License"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={12} className="text-gray-400 hover:text-white" />
              </a>
            </div>

            {/* 모바일 플레이리스트 드롭다운 */}
            {showPlaylist && (
              <div className="absolute top-full right-0 mt-1 bg-gray-800/95 backdrop-blur-md border border-gray-700 rounded-lg shadow-xl w-[calc(100vw-24px)] max-w-[320px] max-h-[300px] overflow-y-auto z-[70]">
                <div className="p-2">
                  <div className="text-gray-400 text-xs font-semibold mb-2 px-2">
                    Playlist ({playlist.length} tracks)
                  </div>
                  {playlist.map((track, index) => (
                    <div
                      key={index}
                      onClick={() => selectTrack(index)}
                      className={`p-2 rounded-lg cursor-pointer transition-all ${
                        index === currentTrack
                          ? 'bg-gray-700 border border-gray-600'
                          : 'hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold text-xs truncate ${
                            index === currentTrack ? 'text-white' : 'text-gray-200'
                          }`}>
                            {track.title}
                          </div>
                          <div className="text-gray-400 text-[10px] truncate">
                            {track.artist}
                          </div>
                        </div>
                        {index === currentTrack && (
                          <div className="flex-shrink-0 text-green-400 text-xs">
                            {isPlaying ? '▶' : '⏸'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;

