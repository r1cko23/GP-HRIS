-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[loanlistinsert]
	-- Add the parameters for the stored procedure here
	@idemployee int,
	@idclient int,
	@iddepart int,
	@uname nvarchar(20),
	@datecreated varchar(50)
	
AS

BEGIN
SET NOCOUNT ON;
DECLARE @loandate DATE = GETDATE();
DECLARE @loandatestart DATE = GETDATE();

INSERT INTO loan
(	
employee_id
,idclientloan
,iddepartmentloan
,loanamount
,monthstopay
,paymentterm
,loandate
,loandatestart
,interestrate
,monthlysemiinterest
,monthlysemiprincipal
,partialamounttopay
,approve
,loanstatus
,loancreatedby
,loandatecreated
)

VALUES			
(@idemployee
,@idclient	
,@iddepart
,0
,0
,'Semi-Monthly'
,@loandate	
,@loandatestart
,0
,0
,0
,0
,'F'
,'Unpaid'
,@uname
,@datecreated  
)

END
