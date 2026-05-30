local availableKey = KEYS[1]
local preoccupiedKey = KEYS[2]
local qty = tonumber(ARGV[1])

local available = tonumber(redis.call('GET', availableKey) or '0')

if available >= qty then
    redis.call('DECRBY', availableKey, qty)
    redis.call('INCRBY', preoccupiedKey, qty)
    return 1
else
    return 0
end
