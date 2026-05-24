import React from 'react';

export default function EmbedBuilder({ embed, onChange }) {
  const handleChange = (key, value) => {
    onChange({
      ...embed,
      [key]: value
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Editor Panel */}
      <div className="space-y-4 p-5 rounded-xl bg-cardBgSolid border border-white/5">
        <h4 className="text-md font-semibold text-white mb-2">Configure Embed Fields</h4>
        
        <div>
          <label className="block text-xs font-semibold text-textGray uppercase mb-1.5">Embed Title</label>
          <input 
            type="text" 
            value={embed.title || ''} 
            onChange={(e) => handleChange('title', e.target.value)}
            className="w-full bg-[#08080c] border border-white/10 text-sm rounded-lg p-2.5 focus:outline-none focus:border-accentRed"
            placeholder="Welcome to {server}!"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-textGray uppercase mb-1.5">Embed Description</label>
          <textarea 
            rows={4}
            value={embed.description || ''} 
            onChange={(e) => handleChange('description', e.target.value)}
            className="w-full bg-[#08080c] border border-white/10 text-sm rounded-lg p-2.5 focus:outline-none focus:border-accentRed"
            placeholder="Glad to have you here, {user}!"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-textGray uppercase mb-1.5">Accent Color</label>
            <div className="flex space-x-2">
              <input 
                type="color" 
                value={embed.color || '#ff003c'} 
                onChange={(e) => handleChange('color', e.target.value)}
                className="w-10 h-10 bg-transparent border-0 cursor-pointer"
              />
              <input 
                type="text" 
                value={embed.color || '#ff003c'} 
                onChange={(e) => handleChange('color', e.target.value)}
                className="w-full bg-[#08080c] border border-white/10 text-sm rounded-lg px-2 focus:outline-none focus:border-accentRed"
              />
            </div>
          </div>
          <div className="flex items-center pt-6 pl-4">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input 
                type="checkbox" 
                checked={embed.thumbnail || false} 
                onChange={(e) => handleChange('thumbnail', e.target.checked)}
                className="w-4.5 h-4.5 accent-accentRed rounded"
              />
              <span className="text-sm font-semibold text-white">Show User Avatar</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-textGray uppercase mb-1.5">Banner Image URL</label>
          <input 
            type="text" 
            value={embed.imageUrl || ''} 
            onChange={(e) => handleChange('imageUrl', e.target.value)}
            className="w-full bg-[#08080c] border border-white/10 text-sm rounded-lg p-2.5 focus:outline-none focus:border-accentRed"
            placeholder="https://example.com/banner.gif"
          />
        </div>
      </div>

      {/* Live Preview Panel */}
      <div className="p-5 rounded-xl bg-cardBgSolid border border-white/5 flex flex-col">
        <h4 className="text-md font-semibold text-white mb-4">Discord Preview</h4>
        
        {/* Discord Chat Simulator */}
        <div className="bg-[#2f3136] rounded-lg p-4 flex-1 flex flex-col font-sans select-none">
          <div className="flex items-start space-x-3.5">
            {/* Bot Avatar */}
            <div className="w-10 h-10 rounded-full bg-accentRed flex items-center justify-center text-xs font-gaming font-black shadow-neonGlow text-white">
              R
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-white font-semibold text-sm hover:underline cursor-pointer">RAGE OPTIMIZER</span>
                <span className="bg-[#5865f2] text-[10px] text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider scale-90">BOT</span>
                <span className="text-[#a3a6aa] text-xs">Today at 12:00 PM</span>
              </div>
              
              {/* Discord Native-looking Embed */}
              <div 
                className="mt-2.5 border-l-4 rounded-r-md bg-[#202225] p-3.5 max-w-[450px] relative" 
                style={{ borderColor: embed.color || '#ff003c' }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-4">
                    {embed.title && (
                      <div className="text-white text-md font-semibold mb-1 cursor-pointer hover:underline">
                        {embed.title.replace(/{server}/g, 'Rage Esports').replace(/{user}/g, '@RageDeveloper')}
                      </div>
                    )}
                    {embed.description && (
                      <div className="text-[#dcddde] text-sm whitespace-pre-wrap leading-relaxed">
                        {embed.description.replace(/{server}/g, 'Rage Esports').replace(/{user}/g, '@RageDeveloper').replace(/{membercount}/g, '1420')}
                      </div>
                    )}
                  </div>
                  {embed.thumbnail && (
                    <img 
                      src="https://cdn.discordapp.com/embed/avatars/0.png" 
                      className="w-14 h-14 rounded-full"
                      alt="user thumbnail"
                    />
                  )}
                </div>

                {embed.imageUrl && (
                  <div className="mt-3.5 rounded overflow-hidden max-h-[220px]">
                    <img 
                      src={embed.imageUrl} 
                      className="w-full h-full object-cover" 
                      alt="embed attachment"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
