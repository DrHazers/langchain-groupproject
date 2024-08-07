import requests
from bs4 import BeautifulSoup
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain.docstore.document import Document
from langchain.chains import create_history_aware_retriever
from langchain_core.prompts import MessagesPlaceholder, ChatPromptTemplate
from modelchoise import models

chat_model = models.get_openai_chat_model()

EMBEDDING_DEVICE = "cpu"
embeddings = HuggingFaceEmbeddings(model_name=r"..\models\m3e-base", model_kwargs={'device': EMBEDDING_DEVICE})

text_splitter = RecursiveCharacterTextSplitter()


def fetch_text_from_web(url):
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')
    paragraphs = soup.find_all('p')
    return [para.get_text() for para in paragraphs]


url = "https://baike.baidu.com/item/%E5%85%AB%E5%A4%A7%E8%A1%8C%E6%98%9F/7990672"
web_texts = fetch_text_from_web(url)

all_split_texts = []
for text in web_texts:
    splitted_web_texts = text_splitter.split_text(text)
    all_split_texts.extend(splitted_web_texts)

documents = [Document(page_content=text) for text in all_split_texts]

vectorstore = FAISS.from_documents(documents, embeddings)
retriever = vectorstore.as_retriever()
# prompt_template = PromptTemplate.from_template("""
# You are an intelligent question-answering system. Please note the following points:
# 1.Only retrieve information from the vectorstore and generate an answer when the user’s question involves planets in the solar system.
# 2.Otherwise, generate a default response or prompt the user to ask questions about other topics.
# """)

# retriever_from_llm = MultiQueryRetriever.from_llm(retriever=retriever, llm=chat_model, prompt=prompt_template)
#
# qa_chain = RetrievalQA.from_chain_type(chat_model, retriever=retriever_from_llm)


# from langchain_core.messages import HumanMessage
# from langchain_core.runnables.history import RunnableWithMessageHistory
# from langchain_community.chat_message_histories import SQLChatMessageHistory
# from sqlalchemy import create_engine, Table, MetaData
#
#
# def get_session_history(session_id):
#     return SQLChatMessageHistory(session_id, "sqlite:///memory.db")
#
#
# def del_session_history(session_id):
#     # 创建与 SQLite 数据库的连接
#     engine = create_engine("sqlite:///memory.db")
#     metadata = MetaData()
#     chat_message_history_table = Table('message_store', metadata, autoload_with=engine)
#     with engine.begin() as connection:
#         delete_statement = chat_message_history_table.delete().where(
#             chat_message_history_table.c.session_id == session_id)
#         connection.execute(delete_statement)
#
#
# # def create_new_chat():
#
#
#
# runnable_with_history = RunnableWithMessageHistory(
#     QA_chain,
#     get_session_history,
# )
# del_session_history("1a")
# print(runnable_with_history.invoke(
#     "hello,i'm job",
#     config={"configurable": {"session_id": "1a"}},
# ))
# print(runnable_with_history.invoke(
#     "what's my name?",
#     config={"configurable": {"session_id": "1a"}},
# ))


# 生成 ChatModel 会话的提示词
prompt = ChatPromptTemplate.from_messages([
    MessagesPlaceholder(variable_name="chat_history"),
    ("user", "{input}"),
    ("user",
     "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation")

])
# 生成含有历史信息的检索链
retriever_chain = create_history_aware_retriever(chat_model, retriever, prompt)

# 继续对话，记住检索到的文档等信息
prompt = ChatPromptTemplate.from_messages([
    ("system", """
 You are an intelligent question-answering system. Please note the following points:
 1.Answer the user's questions based on the below context:\n\n{context} when the user’s question involves planets in the solar system.
 2.Otherwise, generate a default response or prompt the user to ask questions about other topics.
 """),
    MessagesPlaceholder(variable_name="chat_history"),
    ("user", "{input}"),
])
from langchain.chains.combine_documents import create_stuff_documents_chain

document_chain = create_stuff_documents_chain(chat_model, prompt)
from langchain.chains.retrieval import create_retrieval_chain

retrieval_chain = create_retrieval_chain(retriever_chain, document_chain)

from langchain_core.messages import HumanMessage, AIMessage

# 模拟一个历史会话记录
chat_history = [HumanMessage(content="我叫job"),
                AIMessage(content="你好,job,有什么可以帮助你的吗")]

from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

result = None


@app.route('/')
def index():
    return render_template("start-board.html")


@app.route('/index')
def start_board():
    return render_template("index.html")


@app.route('/submit-form', methods=['POST'])
def submit_form():
    data = request.get_json()
    question = data.get('question')
    global result
    result = retrieval_chain.invoke({
        "chat_history": chat_history,
        "input": question
    })
    print(result)
    result = result.get('answer')
    chat_history.append(HumanMessage(content=question))
    chat_history.append(AIMessage(content=result))
    return jsonify({'status': 'success', 'message': 'Form data received'}), 200


@app.route('/get-data')
def get_data():
    global result
    data = {
        'message': result,
    }
    return jsonify(data)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
