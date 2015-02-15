This repo is a place for me to keep my demos and toy apps. For the moment only one is working:


Picker
-------------

Picker is a toy stock-picker application, though it is not intended to provide actual stock picking advice. Let me say that again. **Picker is not intended to provide financial advice!** Picker is intended to be a demonstration of various software development technologies, and a place for me to experiment with new ones.

See it live here (works best in Chrome): [http://apps.sloanahrens.com/picker/picker.html](http://apps.sloanahrens.com/picker/picker.html)

I started the project by forking the [app-template](https://github.com/nprapps/app-template) repo from the NPR development team, by following the instructions in their [blog post](http://blog.apps.npr.org/2014/09/08/how-to-setup-the-npr-app-template-for-you-and-your-news-org.html). The project provides infrastructure for setting up a web application that can be (relatively) easily deployed to Amazon EC2 and S3. Static content can be hosted from S3 (very cheaply), while the dynamic portion of the application can be hosted on EC2 servers.

Picker uses the [ystockquote](https://pypi.python.org/pypi/ystockquote) library to download price data for financial instruments (by ticker), saves the data to [Elasticsearch](http://www.elasticsearch.org/), does some analysis on the data (details [here](https://github.com/sloanahrens/picker/blob/master/modules/picker_data.py)) and saves the results back to Elasticsearch. The UI makes AJAX calls to the server application to access the data. The charts are built with the [Flot](http://www.flotcharts.org/) libary for [jQuery](http://jquery.com/), based on some techniques I found in this online book: [Data Visualization with JavaScript](http://jsdatav.is/intro.html).

The charts currently provided (subject to change) are as follows:

* Adjusted Close for the security selected (by ticker symbol) and an index. [SPY](http://finance.yahoo.com/q?s=SPY) is currently used for the index.
* Scaled Adjusted Close (the security's adjusted closing price divided by the index's adjusted closing price), plotted against a 20-month (86-week) moving average of Scaled Adjusted Close (SACMA)

Also shown are a list of "Buy" and "Sell" picks, based in a simple algorithm. If SAC is less than SACMA, but has been greater than SACMA in the last year, the ticker is marked as a "Buy" pick. If SAC is greater than SACMA, the ticker is marked as a "Sell" pick.

More functionality will be added to the project as I have time. Feel free to clone/fork the repo yourself; some rudimentary installation/deployment instructions can be found [here](https://github.com/sloanahrens/picker/blob/master/deployment.sh). 

