// File generated manually for Firebase configuration
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for use with your Firebase apps.
///
/// Example:
/// ```dart
/// import 'firebase_options.dart';
/// // ...
/// await Firebase.initializeApp(
///   options: DefaultFirebaseOptions.currentPlatform,
/// );
/// ```
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError(
        'DefaultFirebaseOptions have not been configured for web - '
        'you can reconfigure this by running the FlutterFire CLI again.',
      );
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for macos - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.windows:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for windows - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCsWI4rXPp1CD381uhND546IvKVKOLQ20M',
    appId: '1:1026466488683:android:7c1322ea17755a95fe2c2e',
    messagingSenderId: '1026466488683',
    projectId: 'bitcoin-mining-master-24993',
    storageBucket: 'bitcoin-mining-master-24993.firebasestorage.app',
    androidClientId: '1026466488683-1ps9vc7puchr9don7fmja0vrnngj78kk.apps.googleusercontent.com',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyAcJ7fMB7YUwRF5_aOIVFaJDKvlMIoC0V4',
    appId: '1:1026466488683:ios:16a2a89367405e47fe2c2e',
    messagingSenderId: '1026466488683',
    projectId: 'bitcoin-mining-master-24993',
    storageBucket: 'bitcoin-mining-master-24993.firebasestorage.app',
    iosBundleId: 'com.cloudminingtool.bitcoinMiningMaster',
    iosClientId: '1026466488683-f77ipeggp36cd2cjhd2min348n2ahio7.apps.googleusercontent.com',
  );
}
