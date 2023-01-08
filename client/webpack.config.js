const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/index.js',
    mode: "development",
    target: "web",
    plugins: [
        new HtmlWebpackPlugin({
            template: "/src/index.html"
        }),
    ],
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true
    },
    resolve: { extensions: ["*", ".js", ".jsx"] },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /(node_modules|bower_components)/,
                loader: "babel-loader",
                options: { presets: ["@babel/env"] }
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    devtool: "eval",
};