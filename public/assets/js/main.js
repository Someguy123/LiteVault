$(document).ready(function() {
    // For security, no external scripts on the wallet pages
    if(document.location.pathname !== "/wallet/login" && document.location.pathname !== "/wallet/register") {
        CoinWidgetCom.go({
            wallet_address: 'LNWEjx3DKSAWKX5fkWfCwa2tWSQeo7ZmnR',
            currency: 'litecoin',
            counter: 'amount',
            lbl_button: 'Donate',
            lbl_count: 'donations',
            lbl_amount: 'LTC',
            lbl_address: 'Use address below to donate. Thanks!',
            qrcode: true,
            alignment: 'bl',
            decimals: 8,
            size: "small",
            color: "dark",
            countdownFrom: "100",
            element: "#coinwidget-litecoin-LNWEjx3DKSAWKX5fkWfCwa2tWSQeo7ZmnR",
            onShow: function () {
            },
            onHide: function () {
            }
        });
        CoinWidgetCom.go({
            wallet_address: '17PPTHmS8N34KYKdDc4Gn1psabteGS8EE3',
            currency: 'bitcoin',
            counter: 'amount',
            lbl_button: 'Donate',
            lbl_count: 'donations',
            lbl_amount: 'BTC',
            lbl_address: 'Use address below to donate. Thanks!',
            qrcode: true,
            alignment: 'bl',
            decimals: 8,
            size: "small",
            color: "dark",
            countdownFrom: "0",
            element: "#coinwidget-bitcoin-17PPTHmS8N34KYKdDc4Gn1psabteGS8EE3",
            onShow: function () {
            },
            onHide: function () {
            }
        });
    }
});