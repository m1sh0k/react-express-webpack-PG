const path = require('path');
const WriteFilePlugin = require('write-file-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');


console.log('webPack output path: ',path.resolve(__dirname, '../public/prod'));

module.exports = {
    mode: 'production',
    performance: {
        hints: 'warning'
    },



    entry: {
        main: [path.resolve(__dirname, '../src/index.js')]
    },

    output: {
        path: path.resolve(__dirname, '../public/prod'),
        filename: 'bundle.js',
        publicPath: '/' || path.resolve(__dirname, '../public/'),
    },
    module: {
        rules: [
            {
                test: /\.js?$/,
                loader: ['babel-loader'],
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: [ 'style-loader', 'css-loader' ]
            },
            {
                test: /.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
                use: [{loader: 'file-loader'}]
            }, {
                test: /\.(png|jpg|gif)$/,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                            limit: 8192
                        }
                    }
                ]
            }

        ]
    },
    plugins: [
        new WriteFilePlugin(),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, '../public/htmlTemp/index.html')
        }),
    ],
};