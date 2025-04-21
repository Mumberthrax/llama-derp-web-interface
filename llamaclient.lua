--! file: llamaclient.lua
-- by Mumberthrax, chatGPT, DeepSeek, and Gemini. (but mostly DeepSeek, tbh.)

local curl = require("cURL")
local lunajson = require("lib.lunajson")

local M = {}

-- Pure function: extract the content from a given chunk.
local function extractContent(chunk)
  local jsonStr = chunk:match("^data:%s*(.*)")
  if not jsonStr then return nil end
  jsonStr = jsonStr:match("^%s*(.-)%s*$")
  if jsonStr == "[DONE]" or jsonStr == "" then return nil end
  local ok, decoded = pcall(lunajson.decode, jsonStr)
  if not ok then
    io.stderr:write("JSON decode error for chunk: ", jsonStr, "\n")
    return nil
  end
  if decoded.choices and decoded.choices[1] and decoded.choices[1].delta then
    return decoded.choices[1].delta.content
  end
  return nil
end

-- Factory function: creates and returns a stream state object.
-- payload: Lua table (pure data)
-- options: table with keys: url, waitTime (ms), maxPolls, onChunk (callback)
function M.createStream(payload, options)
  options = options or {}
  local state = {
    active = true,         -- true while streaming is active
    polls = 0,             -- count of poll steps
    waitTime = options.waitTime or 100,  -- milliseconds
    maxPolls = options.maxPolls or math.huge,
    chunks = {},
    error = nil,
    onChunk = options.onChunk or function() end,
    content = {}
  }
  
  local url = options.url or "http://localhost:8080/v1/chat/completions"
  local data = lunajson.encode(payload)
  
  local easy = curl.easy()
    :setopt_url(url)
    :setopt(curl.OPT_HTTPHEADER, {
        "Content-Type: application/json",
        "Accept: application/json"
      })
    :setopt(curl.OPT_POSTFIELDS, data)
    :setopt_writefunction(function(chunk)
         local content = extractContent(chunk)
         if content then
           state.onChunk(content)
           table.insert(state.content, content)
         end
         table.insert(state.chunks, chunk)
         return #chunk
       end)
  
  state.easy = easy
  local multi = curl.multi()
  multi:add_handle(easy)
  state.multi = multi
  
  return state
end

-- Polls the stream state once.
-- Returns true if the stream is still active, false if completed.
function M.pollStream(state)
  if not state.active then return false end
  
  local still_running = state.multi:perform()
  state.polls = state.polls + 1
  
  -- Add automatic error check
  if not M.checkError(state) then
    state.active = false
    state.multi:close()
    return false
  end
  
  if still_running == 0 or state.polls >= state.maxPolls then
    state.active = false
    state.multi:close()
    return false
  end
  
  state.multi:wait(state.waitTime)
  return state.active
end


-- Helper: returns the full concatenated response.
function M.getContent(state)
  return table.concat(state.chunks)
end

-- Error checker: returns false if the HTTP response indicates an error.
function M.checkError(state)
  local code = state.easy:getinfo(curl.INFO_RESPONSE_CODE)
  if code and code >= 400 then
    state.error = "HTTP Error: " .. code
    return false
  end
  return true
end

-- Cleanup function: forcefully closes the stream.
function M.closeStream(state)
  if state.multi and state.active then
    state.multi:close()
  end
  state.active = false
end

return M
