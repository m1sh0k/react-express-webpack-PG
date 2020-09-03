const path = require('path');
const WriteFilePlugin = require('write-file-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require("webpack");


console.log('webPack output path: ',path.resolve(__dirname, '../public/dev'));

module.exports = {
    mode: 'development',
    devtool: 'inline-source-map',

    devServer: {
        contentBase: './public',
        hot: true
    },



    entry: {
        main: [path.resolve(__dirname, '../src/index.js'),"webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000"]
    },

    output: {
        path: path.resolve(__dirname, '../public/dev'),
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
        new WriteFilePlugin({
            // exclude hot-update files
            test: /^(?!.*(hot)).*/,
            //OR
            // Write only files that have ".js", ".html" extension.
            //test: /.(js|html?)$^(?!.*(hot)).*/,
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, '../public/htmlTemp/index.html')
        }),
        new webpack.HotModuleReplacementPlugin()
    ],
};