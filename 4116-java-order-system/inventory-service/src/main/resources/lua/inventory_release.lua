local availableKey = KEYS[1]
local preoccupiedKey = KEYS[2]
local qty = tonumber(ARGV[1])

local preoccupied = tonumber(redis.call('GET', preoccupiedKey) or '0')

if preoccupied >= qty then
    redis.call('DECRBY', preoccupiedKey, qty)
    redis.call('INCRBY', availableKey, qty)
    return 1
else
    return 0
end
