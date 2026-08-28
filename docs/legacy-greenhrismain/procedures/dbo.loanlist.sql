-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[loanlist]
	-- Add the parameters for the stored procedure here
		@idclient int,
		@idemployee int
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

SELECT        loan.idloan
				,loan.employee_id
				,loan.particular
				,loan.loanamount
				,loan.paymentterm
				,loan.monthstopay
				,loan.loandate
				,loan.loandatestart
				,loan.loanstatus
				,loan.interestrate
				,loan.monthlysemiinterest
				,loan.monthlysemiprincipal
				,loan.partialamounttopay
				,employee.idclient
				,loan.idclientloan
				,CASE 
					WHEN employee.idclient = loan.idclientloan THEN 'E' ELSE 'NE' END AS ComparisonResult
				,loan.iddepartmentloan
				,Employee.department_code
				,loan.approve
				,loancreatedby
				,loandatecreated
				,loanupdateby
				,loandateupdate
	

FROM            loan INNER JOIN
                         Employee ON loan.employee_id = Employee.Employee_id
        	   WHERE  loan.employee_id = @idemployee ORDER BY idloan 
		--WHERE loan.idclientloan= @idclient and  loan.employee_id = @idemployee ORDER BY idloan 

END
