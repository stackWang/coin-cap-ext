// background.js

// 存储用户设定的价格阈值
let priceThresholds = {};
let logoMap = {};

// 初始化WebSocket连接
function initWebSocket() {
    const wsUrl = 'wss://graphql.coincap.io/';
    let socket;

    function connectSocket() {
        socket = new WebSocket(wsUrl, ['graphql-ws']);

        socket.onopen = () => {
            console.log('Connected to WebSocket');
            subscribeToPrices();
        };

        socket.onmessage = (event) => {
            handlePriceUpdate(JSON.parse(event.data));
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        socket.onclose = () => {
            console.log('WebSocket connection closed, retrying...');
            setTimeout(connectSocket, 5000); // 尝试重新连接
        };
    }

    // 订阅所需的价格数据
    function subscribeToPrices() {
        socket.send("{\"type\":\"connection_init\",\"payload\":{}}");
        socket.send("{\"id\":\"1\",\"type\":\"start\",\"payload\":{\"variables\":{\"assetIds\":false},\"extensions\":{},\"query\":\"subscription ($assetIds: [ID]) {\\n averagePriceUpdates(assetIds: $assetIds) {\\n assetId\\n priceUsd\\n __typename\\n }\\n}\\n\"}}");
        socket.send("{\"id\":\"1\",\"type\":\"stop\"}\t");
        socket.send("{\"id\":\"2\",\"type\":\"start\",\"payload\":{\"variables\":{\"assetIds\":[\"bitcoin\",\"ethereum\",\"tether\",\"xrp\",\"binance-coin\",\"solana\",\"dogecoin\",\"usd-coin\",\"cardano\",\"steth\",\"tron\",\"avalanche\",\"chainlink\",\"stellar\",\"shiba-inu\",\"wrapped-bitcoin\",\"sp8de\",\"polkadot\",\"bitcoin-cash\",\"uniswap\"]},\"extensions\":{},\"query\":\"subscription ($assetIds: [ID]) {\\n averagePriceUpdates(assetIds: $assetIds) {\\n assetId\\n priceUsd\\n __typename\\n }\\n}\\n\"}}");
    }

    // 处理接收到的价格更新
    function handlePriceUpdate(data) {
        if (data && data.payload && data.payload.data && data.payload.data.averagePriceUpdates) {
            data.payload.data.averagePriceUpdates.forEach(update => {
                const { assetId, priceUsd } = update;
                const thresholdUp = priceThresholds[assetId + '_up'];
                const thresholdDown = priceThresholds[assetId + '_down'];

                if (thresholdUp && parseFloat(priceUsd) >= thresholdUp) {
                    showNotification(assetId, priceUsd, thresholdUp);
                }
                if (thresholdDown && parseFloat(priceUsd) <= thresholdDown) {
                    showNotification(assetId, priceUsd, thresholdDown);
                }
            });
        }
    }


    async function checkResourceExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok; // 状态码在200-299之间表示成功
        } catch (error) {
            console.error('Error checking resource:', error);
            return false;
        }
    }

    // 显示通知
    let lastNotifyTime = {}; // 存储最后一次通知的时间，以避免频繁重复的通知
    function showNotification(symbol, currentPrice, threshold) {
        if (lastNotifyTime[symbol] && Date.now() - lastNotifyTime[symbol] < 60000) {
            return; // 避免在短时间内重复发送通知
        }

        lastNotifyTime[symbol] = Date.now();
        let target = logoMap[symbol]
        let url = `https://assets.coincap.io/assets/icons/${target.logo}@2x.png`
        if (!target || !checkResourceExists(url)) {
            url = 'icon16_1.png'
        }

        chrome.notifications.create(null, {
            type: 'basic',
            //iconUrl: 'icon16_1.png',
            iconUrl: url,
            title: `【${target.symbol}】价格预警`,
            message: `【${target.symbol}】价格达到阈值 .\n当前: $${currentPrice}\n阈值: $${threshold}`
        }, function(notificationId) {
            console.log(`Notification created with ID: ${notificationId}`);
        });
    }

    connectSocket();
}

// 加载存储的价格阈值
chrome.storage.sync.get(null, (items) => {
    priceThresholds = items;
});

// 监听来自popup或其他地方的价格阈值更新
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'updateThreshold':
            console.log('Updating threshold:', request);
            const { symbol, threshold } = request;
            priceThresholds[symbol] = parseFloat(threshold);
            chrome.storage.sync.set({ [symbol]: threshold }, () => {
                console.log(`Updated threshold for ${symbol}: ${threshold}`);
            });
            break;
        case 'getThresholds':
            sendResponse(priceThresholds);
            return true; // 表示消息将异步回复，不需要等待回调函数执行完毕
        case 'logoMap':
            logoMap = request.logoMap;
        default:
            // 其他操作或错误处理
            break;
    }
});

// 启动WebSocket连接
initWebSocket();