document.addEventListener('DOMContentLoaded', function () {
    // document.getElementById('showNotification').addEventListener('click', () => {
    //     chrome.notifications.create({
    //         type: 'basic',
    //         iconUrl: 'icon16_1.png',
    //         title: 'Global Notification',
    //         message: 'This is a global notification!'
    //     });
    // });

    const cryptoTableBody = document.querySelector('#cryptoTable tbody');

    var currentSort = {direction: 'ASC', first:20, sort: 'rank'};
    document.querySelectorAll('#cryptoTable th').forEach(s => {
        s.addEventListener('click', function (event) {
            const sort = event.target.getAttribute('data-sort');
            if (sort) {
                currentSort.direction = event.target.getAttribute('data-direction') === 'ASC' ? 'DESC' : 'ASC';
                currentSort.sort = sort;
                event.target.setAttribute('data-direction', currentSort.direction);
                fetchCryptoData().then(updateTable);
            }
        })
    });

    document.getElementById('cryptoTable').addEventListener('keydown', function(event) {
        if (event.target.matches('span.thresholdForm') && event.key === 'Enter') {
            event.preventDefault(); // 阻止默认行为（如换行）

            const value = event.target.textContent
            const symbol = event.target.getAttribute('name')
            console.log(symbol, value);
            sendMessageToBackground({
                action: 'updateThreshold',
                symbol: symbol,
                threshold: value
            });
            event.target.blur(); // 移除焦点，防止再次触发键盘事件
        }
    });


    // 模拟从API获取的数据
    async function fetchCryptoData() {

        var body = {query: "query ($after: String, $before: String, $direction: SortDirection, $first: Int, $last: Int, $sort: AssetSortInput) {\n  assets(\n    after: $after\n    before: $before\n    direction: $direction\n    first: $first\n    last: $last\n    sort: $sort\n  ) {\n    pageInfo {\n      startCursor\n      endCursor\n      hasNextPage\n      hasPreviousPage\n      __typename\n    }\n    edges {\n      cursor\n      node {\n        changePercent24Hr\n        name\n        id\n        logo\n        marketCapUsd\n        priceUsd\n        rank\n        supply\n        symbol\n        volumeUsd24Hr\n        vwapUsd24Hr\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n"};
        body.variables = currentSort;

        const response = await fetch("https://graphql.coincap.io/", {
            "body": JSON.stringify(body),
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            mode: "cors",
            credentials: "omit"
        });
        const data = await response.json();
        const thresholds = await loadThresholds();

        let logoMap = {};
        for (let k of data.data.assets.edges) {
            logoMap[k.node.id] = {logo: k.node.logo, symbol: k.node.symbol}
        }
        await sendMessageToBackground({action: 'logoMap', logoMap: logoMap})

        return data.data.assets.edges.map(edge => ({
            id: edge.node.id,
            rank: edge.node.rank,
            logo: edge.node.logo,
            name: edge.node.name,
            symbol: edge.node.symbol,
            price: '$' + parseFloat(edge.node.priceUsd).toFixed(edge.node.priceUsd > 0.01 ? 2 : 4),
            marketCap: '$' + (parseFloat(edge.node.marketCapUsd) / 1000000000).toFixed(2) + 'b',
            volume: '$' + (parseFloat(edge.node.volumeUsd24Hr) / 1000000000).toFixed(2) + 'b',
            change: `${(100 * (parseFloat(edge.node.changePercent24Hr) / 100)).toFixed(2)}%`,
            thresholdUp: thresholds && thresholds[edge.node.id + '_up'] ? thresholds[edge.node.id + '_up'] : '',
            thresholdDown: thresholds && thresholds[edge.node.id + '_down'] ? thresholds[edge.node.id + '_down'] : ''
        } ));
    }

    // 加载当前的所有阈值并显示在页面上
    async function loadThresholds() {
        try {
            return await sendMessageToBackground({ action: 'getThresholds' });
        } catch (error) {
            console.error('Error loading thresholds:', error);
        }
    }

    function sendMessageToBackground(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (!response) {
                    resolve(null);
                }

                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }

    // 更新表格内容
    function updateTable(data) {
        if (!data) {
            return
        }
        console.log(data);
        document.querySelector('#time').innerText = new Date().toLocaleTimeString();

        cryptoTableBody.innerHTML = ''; // 清空现有内容
        data.forEach(item => {
            const row = `<tr>
                            <td style="text-align: center">${item.rank}</td>
                            <td>
                                <img src="https://assets.coincap.io/assets/icons/${item.logo}@2x.png" class="coin-logo">
                                <div class="coin-names">
                                  <div class="coin-name">${item.name}</div>
                                  <div class="sub-name">${item.symbol}</div>
                                </div>
                            </td>
                            <td>${item.price}</td>
                            <td>${item.marketCap}</td>
                            <td>${item.volume}</td>
                            <td class="${item.change.startsWith('-') ? 'text-danger' : 'text-success'}">${item.change}</td>
                            <td>
                                <div class="threshold">>=<span contenteditable="true" name="${item.id}_up" class="thresholdForm">${item.thresholdUp ? item.thresholdUp : ''}</span></div>
                                <div class="threshold"><=<span contenteditable="true" name="${item.id}_down" class="thresholdForm">${item.thresholdDown ? item.thresholdDown : ''}</span></div>
                            </td>
                         </tr>`;
            cryptoTableBody.insertAdjacentHTML('beforeend', row);
        });
        // <input type="text" class="thresholdForm" name="${item.id}_up" placeholder=">" value="${item.thresholdUp ? item.thresholdUp : ''}"/>
        // <input type="text" class="thresholdForm" name="${item.id}_down" placeholder="<" value="${item.thresholdDown ? item.thresholdDown : ''}"/>
    }

    // 初始加载数据
    fetchCryptoData().then(data => updateTable(data));

    // 定时刷新数据（例如每分钟一次）
    setInterval(() => {
        fetchCryptoData(currentSort).then(data => updateTable(data));
    }, 50000); // 60秒 = 60000毫秒
});

function sortBy(sort) {

}