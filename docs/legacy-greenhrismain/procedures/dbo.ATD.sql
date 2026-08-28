-- =============================================
-- Author:		<Author,,Name>
-- Create date: <Create Date,,>
-- Description:	<Description,,>
-- =============================================
CREATE PROCEDURE [dbo].[ATD]
--@paraidclientp int,
--@paraiddepart nchar(10)
--@paradatestart date
--@uname varchar(20), 
--@datestart date
AS	

BEGIN
--SET @paradatestart = CONVERT(DATE, @paradatestart, 101) 
--SET @paradatestart = '2023-04-01'

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

SELECT lname2 + ', ' + fname2 AS fullname, payrollatmno, payrollpaytype, netamount, idclientp, Date_Start, department_codep 
FROM payroll_summary as ps1


END

