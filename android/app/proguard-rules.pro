# DuyDev Studio Proguard Rules
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class vn.alphadaniel.duydevstudio.AndroidBridge { *; }
