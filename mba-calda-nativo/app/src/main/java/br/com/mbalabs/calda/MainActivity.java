package br.com.mbalabs.calda;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RadialGradient;
import android.graphics.Rect;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.TextWatcher;
import android.text.style.ForegroundColorSpan;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.Locale;

/** MBA Calda: native Android views, offline and without WebView or network permissions. */
public class MainActivity extends Activity {
    private static final int BG = 0xFF00160D;
    private static final int PANEL = 0xFF042115;
    private static final int INPUT = 0xFF00130A;
    private static final int LIME = 0xFF9BFB4F;
    private static final int CYAN = 0xFF00DCCA;
    private static final int WHITE = 0xFFF4F8F1;
    private static final int MUTED = 0xFFA1B7A8;
    private static final int BORDER = 0xFF2C5733;
    private static final String[] UNITS = {"mL/ha", "L/ha", "g/ha", "kg/ha"};
    private final DecimalFormat fmt = new DecimalFormat("#,##0.###", new DecimalFormatSymbols(new Locale("pt", "BR")));
    private final ArrayList<Product> products = new ArrayList<>();
    private SharedPreferences store;
    private LinearLayout list;
    private EditText tank, rate;
    private TextView areaText, areaDetail, countText;
    private boolean restoring;

    private static class Product {
        LinearLayout card;
        TextView heading, resultLabel;
        EditText name, dose;
        Spinner unit;
    }

    @Override public void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        getWindow().setStatusBarColor(0xFF00130B);
        getWindow().setNavigationBarColor(0xFF00130B);
        getWindow().getDecorView().setSystemUiVisibility(0);
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        store = getSharedPreferences("mba_calda", MODE_PRIVATE);
        buildScreen();
        restore();
        calculate();
    }

    private int dp(float n) { return (int)(n * getResources().getDisplayMetrics().density + .5f); }
    private LinearLayout vertical() { LinearLayout x = new LinearLayout(this); x.setOrientation(LinearLayout.VERTICAL); return x; }
    private LinearLayout horizontal() { LinearLayout x = new LinearLayout(this); x.setOrientation(LinearLayout.HORIZONTAL); return x; }
    private LinearLayout.LayoutParams lp(int w, int h) { return new LinearLayout.LayoutParams(w < 0 ? w : dp(w), h < 0 ? h : dp(h)); }
    private LinearLayout.LayoutParams top(int gap) { LinearLayout.LayoutParams p = lp(-1,-2); p.topMargin = dp(gap); return p; }
    private GradientDrawable shape(int color, int border, float radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color); d.setCornerRadius(dp(radius));
        if(border != Color.TRANSPARENT) d.setStroke(dp(1), border);
        return d;
    }
    private GradientDrawable gradient(int a, int b, int border, int radius) {
        GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[]{a,b});
        d.setCornerRadius(dp(radius));
        if (border != Color.TRANSPARENT) d.setStroke(dp(1),border);
        return d;
    }
    private TextView text(String s, float sp, int color, boolean bold, boolean mono) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(sp); t.setTextColor(color);
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setIncludeFontPadding(true);
        t.setTypeface(Typeface.create(mono?"monospace":"sans-serif-condensed", bold?Typeface.BOLD:Typeface.NORMAL));
        if (mono) t.setLetterSpacing(.15f);
        return t;
    }
    private TextView caps(String s, int sp, int color) {
        TextView t = text(s,sp,color,false,true); t.setLetterSpacing(.23f); return t;
    }
    private void section(LinearLayout page, String index, String title) {
        LinearLayout bar = horizontal(); bar.setGravity(Gravity.CENTER_VERTICAL);
        TextView no = text(index,16,LIME,true,true); no.setLetterSpacing(.05f);
        bar.addView(no);
        TextView name = text(title,18,WHITE,true,false);
        name.setLetterSpacing(.035f);
        LinearLayout.LayoutParams np = lp(-2,-2); np.leftMargin=dp(11); bar.addView(name,np);
        View line = new View(this); line.setBackgroundColor(0xFF245131);
        LinearLayout.LayoutParams lineP = new LinearLayout.LayoutParams(0,dp(1),1);
        lineP.leftMargin=dp(15); bar.addView(line,lineP);
        page.addView(bar,top(28));
    }
    private EditText edit(String hint, boolean numeric) {
        EditText e = new EditText(this);
        e.setSingleLine(true); e.setTextColor(WHITE); e.setHintTextColor(0xFF506358);
        e.setTextSize(19); e.setHint(hint); e.setTypeface(Typeface.create("sans-serif-condensed",Typeface.NORMAL));
        e.setPadding(dp(15),0,dp(12),0);
        e.setBackground(shape(INPUT, BORDER,11));
        if (numeric) e.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        else e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        return e;
    }
    private EditText inputWithSuffix(LinearLayout parent, String hint, String suffix) {
        LinearLayout row = horizontal(); row.setGravity(Gravity.CENTER_VERTICAL);
        EditText edit = new EditText(this);
        edit.setSingleLine(true); edit.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        edit.setBackgroundColor(Color.TRANSPARENT);
        edit.setTextSize(29); edit.setTypeface(Typeface.create("sans-serif-condensed",Typeface.BOLD));
        edit.setTextColor(WHITE); edit.setHintTextColor(0xFF44594E); edit.setHint(hint);
        edit.setPadding(0,0,0,0);
        row.addView(edit,new LinearLayout.LayoutParams(0,dp(53),1));
        TextView u = text(suffix,17,LIME,false,false); row.addView(u);
        parent.addView(row,top(3));
        watch(edit);
        return edit;
    }
    private LinearLayout metric(String title, String hint, String unit) {
        LinearLayout card = vertical();
        card.setBackground(shape(PANEL,BORDER,17));
        card.setPadding(dp(14),dp(13),dp(13),dp(13));
        card.addView(caps(title,12,WHITE));
        return card;
    }
    private void buildScreen() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.setBackground(new GridDrawable());
        scroll.setVerticalScrollBarEnabled(false);
        LinearLayout page = vertical(); page.setPadding(dp(16),dp(20),dp(16),dp(45));
        scroll.addView(page,new ScrollView.LayoutParams(-1,-2));

        LinearLayout hero = vertical();
        hero.setPadding(dp(22),dp(19),dp(20),dp(25));
        hero.setBackground(gradient(0xFF073820,0xFF052619,BORDER,23));
        TextView brand = caps("●  MBA · DRONES AGRÍCOLAS",11,LIME);
        brand.setLetterSpacing(.22f);
        hero.addView(brand);
        TextView heading = text("Calculadora de Calda",30,WHITE,true,false);
        heading.setLetterSpacing(-.017f);
        SpannableString styled = new SpannableString("Calculadora de Calda");
        styled.setSpan(new ForegroundColorSpan(LIME),12,styled.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        heading.setText(styled);
        hero.addView(heading,top(9));
        hero.addView(text("Quanto de cada produto vai em um tanque.",15,MUTED,false,false),top(8));
        page.addView(hero,top(0));

        section(page,"01","DADOS DA APLICAÇÃO");
        LinearLayout inputs = horizontal();
        LinearLayout first = metric("TANQUE","40","L");
        LinearLayout second = metric("TAXA","10","L/ha");
        tank = inputWithSuffix(first,"40","L");
        rate = inputWithSuffix(second,"10","L/ha");
        LinearLayout.LayoutParams half = new LinearLayout.LayoutParams(0,dp(100),1);
        LinearLayout.LayoutParams other = new LinearLayout.LayoutParams(0,dp(100),1);
        other.leftMargin = dp(10);
        inputs.addView(first,half); inputs.addView(second,other);
        page.addView(inputs,top(16));

        LinearLayout result = vertical(); result.setPadding(dp(18),dp(18),dp(18),dp(20));
        GradientDrawable dotted = shape(0xE500160D,0xFF4D9F34,18);
        dotted.setStroke(dp(1),0xFF62A43B,dp(2),dp(3));
        result.setBackground(dotted);
        result.addView(caps("ÁREA POR TANQUE",12,WHITE));
        LinearLayout areaRow = horizontal(); areaRow.setGravity(Gravity.CENTER_VERTICAL);
        areaText = text("— ha",43,LIME,true,false);
        areaRow.addView(areaText,new LinearLayout.LayoutParams(0,dp(72),1));
        CropIcon crop = new CropIcon(this);
        areaRow.addView(crop,lp(67,58));
        result.addView(areaRow,top(0));
        areaDetail = text("Informe tanque e taxa maiores que zero.",13,MUTED,false,false);
        result.addView(areaDetail,top(0));
        page.addView(result,top(16));

        section(page,"02","PRODUTOS DA CALDA");
        list=vertical();
        page.addView(list,top(15));
        TextView add = text("+ ADICIONAR PRODUTO",14,LIME,true,true);
        add.setLetterSpacing(.15f); add.setGravity(Gravity.CENTER);
        add.setBackground(shape(0x160D622B,0xFF6AAE39,16));
        add.setOnClickListener(v->{addProduct("","",0);calculate();});
        page.addView(add,top(12));
        add.getLayoutParams().height=dp(55);
        countText=caps("0/1 PRODUTOS CALCULADOS",12,MUTED);
        countText.setGravity(Gravity.CENTER);
        page.addView(countText,top(21));

        TextView copy = text("COPIAR RESUMO DA CALDA",19,0xFF00170F,true,false);
        copy.setGravity(Gravity.CENTER);
        copy.setBackground(gradient(LIME,CYAN,Color.TRANSPARENT,16));
        copy.setElevation(dp(5));
        copy.setOnClickListener(v->copySummary());
        page.addView(copy,top(20));
        copy.getLayoutParams().height=dp(65);

        TextView clear=caps("LIMPAR TODOS OS CAMPOS",12,0xFFC7D6C8);
        clear.setGravity(Gravity.CENTER); clear.setOnClickListener(v->confirmClear());
        page.addView(clear,top(15)); clear.getLayoutParams().height=dp(50);

        LinearLayout alert=vertical();
        alert.setPadding(dp(16),dp(15),dp(16),dp(15));
        alert.setBackground(shape(0xFF042316,BORDER,17));
        TextView note=text("⚠  Importante: o tanque é o volume FINAL da calda. Confira bula, compatibilidade, sequência de mistura, EPI e orientação técnica antes de preparar ou aplicar.",14,MUTED,false,false);
        note.setLineSpacing(dp(4),1.05f);
        SpannableString ns=new SpannableString(note.getText());
        ns.setSpan(new ForegroundColorSpan(0xFFFFC747),0,13,Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        note.setText(ns);
        alert.addView(note); page.addView(alert,top(20));

        setContentView(scroll);
    }

    private void addProduct(String name,String dose,int selected) {
        Product p=new Product();
        LinearLayout card=vertical(); card.setPadding(dp(16),dp(15),dp(16),dp(16));
        card.setBackground(shape(0xFF042216,BORDER,18)); p.card=card;
        LinearLayout top=horizontal(); top.setGravity(Gravity.CENTER_VERTICAL);
        p.heading=caps("PRODUTO 01",13,LIME);
        top.addView(p.heading,new LinearLayout.LayoutParams(0,dp(40),1));
        TrashIcon trash = new TrashIcon(this);
        trash.setContentDescription("Remover produto");
        trash.setOnClickListener(v->{
            products.remove(p); list.removeView(p.card);
            if(products.isEmpty()) addProduct("","",0);
            reindex(); calculate();
        });
        top.addView(trash,lp(43,41)); card.addView(top);

        p.name=edit("Nome do produto",false); p.name.setText(name);
        card.addView(p.name,top(5)); p.name.getLayoutParams().height=dp(54);

        LinearLayout row=horizontal(); row.setGravity(Gravity.CENTER_VERTICAL);
        p.dose=edit("Dose ex.: 250",true); p.dose.setText(dose);
        row.addView(p.dose,new LinearLayout.LayoutParams(0,dp(54),1));

        p.unit=new Spinner(this);
        ArrayAdapter<String> adapter=new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,UNITS){
            @Override public View getView(int pos,View convert,ViewGroup parent) { return unitText(getItem(pos),false); }
            @Override public View getDropDownView(int pos,View convert,ViewGroup parent) { return unitText(getItem(pos),true); }
        };
        p.unit.setAdapter(adapter);
        p.unit.setBackground(shape(INPUT,BORDER,11));
        p.unit.setSelection(Math.min(UNITS.length-1,Math.max(0,selected)));
        LinearLayout.LayoutParams up = lp(101,54); up.leftMargin=dp(8);
        row.addView(p.unit,up); card.addView(row,top(11));

        LinearLayout output=horizontal();output.setGravity(Gravity.CENTER_VERTICAL);
        GradientDrawable line=shape(0xFF02180D,0xFF27583A,12);
        line.setStroke(dp(1),0xFF286338,dp(2),dp(3));output.setBackground(line);
        output.setPadding(dp(13),dp(11),dp(12),dp(11));
        TextView label=caps("POR TANQUE",11,MUTED);
        output.addView(label,new LinearLayout.LayoutParams(0,-2,1));
        p.resultLabel=text("aguardando dados",13,MUTED,false,false);
        p.resultLabel.setGravity(Gravity.END); p.resultLabel.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_END);
        output.addView(p.resultLabel,new LinearLayout.LayoutParams(0,-2,1.32f));
        card.addView(output,top(11));

        products.add(p);list.addView(card,top(products.size()==1?0:12));
        reindex();watch(p.name);watch(p.dose);
        p.unit.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){
            @Override public void onItemSelected(AdapterView<?> a,View v,int pos,long id){calculate();}
            @Override public void onNothingSelected(AdapterView<?> a){}
        });
    }
    private TextView unitText(String title,boolean drop) {
        TextView t=text(title,16,WHITE,false,false);
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setPadding(dp(13),dp(8),dp(4),dp(8));
        t.setMinHeight(dp(drop?48:50));
        if(drop) t.setBackgroundColor(0xFF062C1A);
        return t;
    }
    private void reindex(){for(int i=0;i<products.size();i++)products.get(i).heading.setText(String.format(Locale.US,"PRODUTO %02d",i+1));}
    private void watch(EditText e){e.addTextChangedListener(new TextWatcher(){
        @Override public void beforeTextChanged(CharSequence s,int start,int count,int after){}
        @Override public void onTextChanged(CharSequence s,int start,int before,int count){calculate();}
        @Override public void afterTextChanged(Editable e){}
    });}
    private Double positive(String text){
        try {
            String s=text.trim().replace(" ","");
            if(s.contains(",")) s=s.replace(".","").replace(',','.');
            double x=Double.parseDouble(s);
            return Double.isFinite(x)&&x>0 ? x : null;
        }catch(Exception e){return null;}
    }
    private Double hectares(){
        if(tank==null||rate==null)return null;
        Double t=positive(tank.getText().toString()); Double r=positive(rate.getText().toString());
        return t==null||r==null?null:t/r;
    }
    private String quantity(double amount,int unit){
        boolean volume=unit<2;
        double base=(unit==0||unit==2)?amount:amount*1000;
        if(base>=1000)return fmt.format(base/1000)+(volume?" L":" kg");
        return fmt.format(base)+(volume?" mL":" g");
    }
    private void calculate(){
        if(areaText==null||countText==null)return;
        Double h=hectares();
        if(h==null){
            areaText.setText("— ha");areaDetail.setText("Informe tanque e taxa maiores que zero.");
        }else{
            SpannableString v=new SpannableString(fmt.format(h)+" ha");
            v.setSpan(new ForegroundColorSpan(MUTED),fmt.format(h).length(),v.length(),Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            areaText.setText(v);
            areaDetail.setText(fmt.format(positive(tank.getText().toString()))+" L ÷ "+fmt.format(positive(rate.getText().toString()))+" L/ha = "+fmt.format(h)+" hectares");
        }
        int complete=0;
        for(Product p:products){
            Double d=positive(p.dose.getText().toString());
            if(h==null||d==null){p.resultLabel.setText("aguardando dados");p.resultLabel.setTextColor(MUTED);}
            else {int u=p.unit.getSelectedItemPosition();if(u<0)u=0;
                p.resultLabel.setText(quantity(h*d,u));p.resultLabel.setTextColor(LIME);complete++;}
        }
        countText.setText(complete+"/"+products.size()+" PRODUTOS CALCULADOS");
        if(!restoring)save();
    }
    private void save(){
        try{
            JSONObject root=new JSONObject();
            root.put("tank",tank.getText().toString());root.put("rate",rate.getText().toString());
            JSONArray arr=new JSONArray();
            for(Product p:products){JSONObject o=new JSONObject();o.put("name",p.name.getText().toString());o.put("dose",p.dose.getText().toString());o.put("unit",p.unit.getSelectedItemPosition());arr.put(o);}
            root.put("products",arr);
            store.edit().putString("state",root.toString()).apply();
        }catch(Exception ignored){}
    }
    private void restore(){
        restoring=true;
        try{
            JSONObject root=new JSONObject(store.getString("state","{}"));
            tank.setText(root.optString("tank",""));rate.setText(root.optString("rate",""));
            JSONArray arr=root.optJSONArray("products");
            if(arr!=null)for(int i=0;i<arr.length();i++){
                JSONObject o=arr.optJSONObject(i);if(o!=null)addProduct(o.optString("name",""),o.optString("dose",""),o.optInt("unit",0));
            }
        }catch(Exception ignored){}
        if(products.isEmpty())addProduct("","",0);
        restoring=false;
    }
    private void copySummary(){
        Double h=hectares();if(h==null){Toast.makeText(this,"Informe tanque e taxa primeiro.",Toast.LENGTH_SHORT).show();return;}
        StringBuilder s=new StringBuilder("MBA CALDA — RESUMO\n");
        s.append("Tanque: ").append(tank.getText()).append(" L\nTaxa: ").append(rate.getText()).append(" L/ha\n");
        s.append("Área por tanque: ").append(fmt.format(h)).append(" ha\n\nPRODUTOS POR TANQUE:\n");
        int complete=0;
        for(Product p:products){
            Double d=positive(p.dose.getText().toString());
            if(d==null)continue;
            int u=Math.max(0,p.unit.getSelectedItemPosition());
            String name=p.name.getText().toString().trim();if(name.isEmpty())name="Produto "+(complete+1);
            s.append("• ").append(name).append(": ").append(quantity(h*d,u)).append(" (dose ").append(fmt.format(d)).append(" ").append(UNITS[u]).append(")\n");complete++;
        }
        if(complete==0){Toast.makeText(this,"Informe ao menos uma dose de produto.",Toast.LENGTH_SHORT).show();return;}
        s.append("\nComplete com água até o volume FINAL do tanque. Confira a bula e a compatibilidade da mistura.");
        ClipboardManager clipboard=(ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE);
        if(clipboard!=null)clipboard.setPrimaryClip(ClipData.newPlainText("Resumo MBA Calda",s.toString()));
        Toast.makeText(this,"Resumo copiado!",Toast.LENGTH_SHORT).show();
    }
    private void confirmClear(){
        new AlertDialog.Builder(this).setTitle("Limpar cálculo?")
            .setMessage("Apagar os valores e todos os produtos adicionados?")
            .setNegativeButton("Cancelar",null).setPositiveButton("Limpar",(d,w)->{
                restoring=true;tank.setText("");rate.setText("");products.clear();list.removeAllViews();
                addProduct("","",0);restoring=false;calculate();
                Toast.makeText(this,"Campos limpos",Toast.LENGTH_SHORT).show();
            }).show();
    }

    /** Faint engineering grid and diffuse lime-green ambient bloom. */
    private class GridDrawable extends Drawable {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        @Override public void draw(Canvas c){
            Rect b=getBounds();float w=b.width(),h=b.height();
            paint.setShader(new LinearGradient(0,0,0,h,BG,0xFF001C0F,Shader.TileMode.CLAMP));
            c.drawRect(b,paint);paint.setShader(null);
            paint.setShader(new RadialGradient(w*.55f,dp(300),w*.72f,
                new int[]{0x392B8A25,0x1021851C,0x00000000},null,Shader.TileMode.CLAMP));
            c.drawRect(b,paint);paint.setShader(null);
            paint.setColor(0x1D39713B);paint.setStrokeWidth(dp(.6f));
            int spacing=dp(31);
            for(int x=0;x<w;x+=spacing)c.drawLine(x,0,x,h,paint);
            for(int y=0;y<h;y+=spacing)c.drawLine(0,y,w,y,paint);
        }
        @Override public void setAlpha(int alpha){}
        @Override public void setColorFilter(android.graphics.ColorFilter cf){}
        @Override public int getOpacity(){return PixelFormat.OPAQUE;}
    }
    private class CropIcon extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        CropIcon(Context c){super(c);} 
        @Override protected void onDraw(Canvas raw){super.onDraw(raw);
            Canvas c=raw;int save=c.save();c.scale(getWidth()/70f,getHeight()/60f);
            p.setColor(LIME);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2.1f);p.setStrokeCap(Paint.Cap.ROUND);
            c.drawLine(35,29,35,9,p);
            Path leaf=new Path();leaf.moveTo(35,22);leaf.cubicTo(16,20,18,5,21,5);leaf.cubicTo(37,6,35,20,35,22);c.drawPath(leaf,p);
            leaf.reset();leaf.moveTo(35,21);leaf.cubicTo(48,3,58,9,57,12);leaf.cubicTo(57,21,42,23,35,21);c.drawPath(leaf,p);
            leaf.reset();leaf.moveTo(8,35);leaf.quadTo(35,26,63,35);c.drawPath(leaf,p);
            for(int i=0;i<3;i++){leaf.reset();leaf.moveTo(7+i*3,42+i*8);leaf.quadTo(35,32+i*7,63-i*3,42+i*8);c.drawPath(leaf,p);}
            c.restoreToCount(save);
        }
    }
    private class TrashIcon extends View {
        private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        TrashIcon(Context c){super(c);setBackground(shape(0xFF092B1B,Color.TRANSPARENT,8));}
        @Override protected void onDraw(Canvas c){super.onDraw(c);
            float mid=getWidth()/2f,top=getHeight()/2f;
            p.setColor(WHITE);p.setStrokeWidth(dp(1.7f));p.setStyle(Paint.Style.STROKE);p.setStrokeCap(Paint.Cap.ROUND);
            c.drawLine(mid-dp(9),top-dp(8),mid+dp(9),top-dp(8),p);
            c.drawLine(mid-dp(4),top-dp(11),mid+dp(4),top-dp(11),p);
            c.drawRoundRect(mid-dp(7),top-dp(5),mid+dp(7),top+dp(11),dp(2),dp(2),p);
            c.drawLine(mid-dp(2.5f),top-dp(2),mid-dp(2.5f),top+dp(7),p);
            c.drawLine(mid+dp(2.5f),top-dp(2),mid+dp(2.5f),top+dp(7),p);
        }
    }
}