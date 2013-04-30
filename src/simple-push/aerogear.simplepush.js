/* AeroGear JavaScript Library
* https://github.com/aerogear/aerogear-js
* JBoss, Home of Professional Open Source
* Copyright Red Hat, Inc., and individual contributors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
* http://www.apache.org/licenses/LICENSE-2.0
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
(function( AeroGear, $, uuid, undefined ) {
    var simpleNotifier, nativePush;
    // Use browser push implementation when available
    // TODO: Test for browser-prefixed implementations
    if ( navigator.push ) {
        nativePush = navigator.push;
    }

    // SimplePush Default Config
    AeroGear.SimplePush = AeroGear.SimplePush || {};
    AeroGear.SimplePush.config = AeroGear.SimplePush.config || {};
    AeroGear.SimplePush.config.pushAppID = AeroGear.SimplePush.config.pushAppID || "";
    AeroGear.SimplePush.config.variantID = AeroGear.SimplePush.config.variantID || "";
    AeroGear.SimplePush.config.pushNetworkURL = AeroGear.SimplePush.config.pushNetworkURL || "ws://" + window.location.hostname + ":7777/simplepush";
    AeroGear.SimplePush.config.pushServerURL = AeroGear.SimplePush.config.pushServerURL || "http://" + window.location.hostname + ":8080/registry/device";

    // Add push to the navigator object
    navigator.push = (function() {
        return {
            register: nativePush ? nativePush.register : function() {
                var request = {};

                if ( !simpleNotifier ) {
                    throw "SimplePushConnectionError";
                }

                request.channelID = uuid();

                simpleNotifier.subscribe({
                    channelID: request.channelID,
                    callback: function( message ) {
                        $( navigator.push ).trigger({
                            type: "push",
                            message: message
                        });
                    }
                });

                // Provide method to inform push server
                request.registerWithPushServer = function( messageType, endpoint ) {
                    $.ajax({
                        contentType: "application/json",
                        dataType: "json",
                        type: "POST",
                        url: AeroGear.SimplePush.config.pushServerURL,
                        headers: {
                            "ag-mobile-app": AeroGear.SimplePush.config.variantID
                        },
                        data: {
                            category: messageType,
                            deviceToken: endpoint.channelID
                        }
                    });
                };

                $( navigator.push ).on( request.channelID + "-success", function( event ) {
                    request.onsuccess( event );
                });

                return request;
            },

            unregister: nativePush ? nativePush.unregister : function( endpoint ) {
                simpleNotifier.unsubscribe( endpoint );
                // TODO: Inform push server?
            }
        };
    })();

    navigator.setMessageHandler = function( messageType, callback ) {
        var handler;
        // TODO: Check for other browser implementations
        if ( navigator.mozSetMessageHandler ) {
            navigator.mozSetMessageHandler.apply( arguments );
            return;
        }

        handler = function( event ) {
            var message = event.message;
            callback.call( this, message );
        };

        $( navigator.push ).on( messageType, handler );
    };

    // Create a Notifier connection to the Push Network
    simpleNotifier = AeroGear.Notifier({
        name: "agPushNetwork",
        type: "SimplePush",
        settings: {
            connectURL: AeroGear.SimplePush.config.pushNetworkURL
        }
    }).clients.agPushNetwork;

    simpleNotifier.connect({
        onConnect: function( data ) {
            var channels, broadcastRequest, broadcastEndpoint;

            // TODO: Store UAID for reconnections?

            // Register broadcast channel
            broadcastRequest = navigator.push.register();
            broadcastRequest.onsuccess = function( event ) {
                broadcastEndpoint = event.target.result;
                broadcastRequest.registerWithPushServer( "broadcast", broadcastEndpoint );
            };

            // Subscribe to any channels that already exist
            channels = simpleNotifier.getChannels();
            for ( var channel in channels ) {
                simpleNotifier.subscribe({
                    channelID: channels[ channel ].channelID,
                    callback: function( message ) {
                        $( navigator.push ).trigger({
                            type: "push",
                            message: message
                        });
                    }
                });
            }
        }
    });
})( AeroGear, jQuery, uuid );
