import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';

const AudioPlayer = () => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const playlist = [
    {
      title: '클로에 (Chloe)',
      artist: 'Neal K Sound',
      src: 'https://d2lals9bcc7in1.cloudfront.net/audio/chloe-neal-k.mp3'
    }
  ];

  const [currentTrack] = useState(0);

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
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
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

  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, currentTime - 10);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, currentTime + 10);
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gradient-to-r from-gray-900/70 to-gray-800/70 border-b-2 border-gray-700/70 shadow-lg backdrop-blur-sm sticky top-0 z-[60]">
      <audio ref={audioRef} src={playlist[currentTrack].src} preload="metadata" />
      
      <div className="max-w-7xl mx-auto px-3 py-2">
        <div className="flex items-center gap-3">
          {/* 트랙 정보 */}
          <div className="min-w-[140px] hidden sm:block">
            <div className="text-white font-semibold text-sm truncate">
              {playlist[currentTrack].title}
            </div>
            <div className="text-gray-300 text-xs truncate">
              {playlist[currentTrack].artist}
            </div>
          </div>

          {/* 재생 컨트롤 */}
          <div className="flex items-center gap-2 relative z-50">
            <button
              onClick={skipBackward}
              className="p-1.5 hover:bg-gray-700 rounded-full transition-colors relative cursor-pointer"
              title="10초 뒤로"
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
              onClick={skipForward}
              className="p-1.5 hover:bg-gray-700 rounded-full transition-colors relative cursor-pointer"
              title="10초 앞으로"
              type="button"
            >
              <SkipForward size={16} className="text-white pointer-events-none" />
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
          <div className="sm:hidden flex-1 min-w-0">
            <div className="text-white font-semibold text-xs truncate">
              {playlist[currentTrack].title}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;

